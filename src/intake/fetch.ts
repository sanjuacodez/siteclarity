import { guardUrl } from './normalize'
import { err, ok, type Result } from '../lib/errors'
import type { Config } from '../lib/config'

export const USER_AGENT =
  'SiteClarityBot/0.1 (+https://github.com/siteclarity/siteclarity; open source answer-readiness audit)'

export interface FetchedPage {
  requestedUrl: string
  finalUrl: string
  html: string
  bytes: number
  /** Bytes the page actually had, when more than we read. */
  totalBytes: number | null
  /** True when only the first `bytes` of the page were analysed. */
  truncated: boolean
  redirectChain: string[]
  robotsAllowed: boolean
  robotsReason: string | null
  fetchedAt: string
}

/**
 * Fetch with manual redirect handling so every hop is re-validated. `redirect: 'follow'`
 * would let a public host bounce us to a private one without inspection.
 */
export async function fetchPage(start: URL, config: Config): Promise<Result<FetchedPage>> {
  const robots = await checkRobots(start, config)

  let current = start
  const chain: string[] = [current.toString()]

  for (let hop = 0; hop <= config.maxRedirects; hop++) {
    const guard = guardUrl(current)
    if (!guard.ok) return guard

    let res: Response
    try {
      res = await fetch(current.toString(), {
        redirect: 'manual',
        headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
        signal: AbortSignal.timeout(config.fetchTimeoutMs),
      })
    } catch (e) {
      return err('fetch_failed', `Request failed: ${(e as Error).message}`)
    }

    if (res.status >= 300 && res.status < 400) {
      const location = res.headers.get('location')
      if (!location) return err('fetch_failed', `Redirect ${res.status} with no Location header`)
      let next: URL
      try {
        next = new URL(location, current)
      } catch {
        return err('fetch_failed', `Invalid redirect target: ${location}`)
      }
      current = next
      chain.push(current.toString())
      continue
    }

    if (!res.ok) return err('fetch_failed', `Upstream returned ${res.status}`)

    const contentType = res.headers.get('content-type') ?? ''
    if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
      return err('not_html', `Expected HTML, got "${contentType || 'unknown'}"`)
    }

    const declared = Number(res.headers.get('content-length') ?? '0') || null

    const read = await readCapped(res, config.maxPageBytes)
    if (!read.ok) return read

    return ok({
      requestedUrl: start.toString(),
      finalUrl: current.toString(),
      html: read.value.text,
      bytes: read.value.bytes,
      totalBytes: declared,
      truncated: read.value.truncated,
      redirectChain: chain,
      robotsAllowed: robots.allowed,
      robotsReason: robots.reason,
      fetchedAt: new Date().toISOString(),
    })
  }

  return err('fetch_failed', `Exceeded ${config.maxRedirects} redirects`)
}

/**
 * Read up to `maxBytes` and stop.
 *
 * Real marketing pages routinely run past a megabyte, and the byte cap exists for the
 * 10 ms CPU limit, not because a large page is suspicious. Rejecting one outright made
 * the tool useless on most of the sites people actually want to audit — cloudflare.com
 * is 1.3 MB. So we analyse what fits and disclose the truncation in the limits block.
 *
 * HTMLRewriter tolerates HTML that stops mid-document, and the cut always lands after
 * the head and the opening body content, which is where the analysable material is.
 */
async function readCapped(
  res: Response,
  maxBytes: number,
): Promise<Result<{ text: string; bytes: number; truncated: boolean }>> {
  const reader = res.body?.getReader()
  if (!reader) return err('fetch_failed', 'Response had no body')

  const chunks: Uint8Array[] = []
  let total = 0
  let truncated = false
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    if (!value) continue
    if (total + value.byteLength > maxBytes) {
      chunks.push(value.subarray(0, maxBytes - total))
      total = maxBytes
      truncated = true
      await reader.cancel()
      break
    }
    total += value.byteLength
    chunks.push(value)
  }

  const buf = new Uint8Array(total)
  let offset = 0
  for (const c of chunks) {
    buf.set(c, offset)
    offset += c.byteLength
  }
  return ok({ text: new TextDecoder().decode(buf), bytes: total, truncated })
}

/**
 * Minimal robots.txt check for our user-agent. Failure to fetch is treated as allowed.
 *
 * Cached through the Workers Cache API: a site scan analyses each page in its own
 * invocation, so without this every page re-fetches the same robots.txt — eight
 * redundant round trips on an eight-page scan, and a material share of wall time.
 */
async function checkRobots(
  target: URL,
  config: Config,
): Promise<{ allowed: boolean; reason: string | null }> {
  try {
    const robotsUrl = new URL('/robots.txt', target)
    const cacheKey = new Request(robotsUrl.toString(), { headers: { 'user-agent': USER_AGENT } })
    const cache = (globalThis as { caches?: { default?: Cache } }).caches?.default

    let res = (await cache?.match(cacheKey)) ?? undefined
    if (!res) {
      res = await fetch(robotsUrl.toString(), {
        headers: { 'user-agent': USER_AGENT },
        signal: AbortSignal.timeout(Math.min(config.fetchTimeoutMs, 5000)),
      })
      if (res.ok && cache) {
        const cacheable = new Response(res.clone().body, res)
        cacheable.headers.set('cache-control', 'max-age=900')
        await cache.put(cacheKey, cacheable)
      }
    }
    if (!res.ok) return { allowed: true, reason: null }

    const text = (await res.text()).slice(0, 100_000)
    const path = target.pathname + target.search
    return evaluateRobots(text, path)
  } catch {
    return { allowed: true, reason: null }
  }
}

/** Exported for testing. Applies `*` and SiteClarityBot groups; longest match wins. */
export function evaluateRobots(
  text: string,
  path: string,
): { allowed: boolean; reason: string | null } {
  const lines = text.split(/\r?\n/)
  let inGroup = false
  let currentAgents: string[] = []
  const rules: { allow: boolean; path: string }[] = []

  for (const raw of lines) {
    const line = raw.replace(/#.*$/, '').trim()
    if (!line) continue
    const [rawKey, ...rest] = line.split(':')
    if (!rawKey || rest.length === 0) continue
    const key = rawKey.trim().toLowerCase()
    const value = rest.join(':').trim()

    if (key === 'user-agent') {
      if (!inGroup) currentAgents = []
      currentAgents.push(value.toLowerCase())
      inGroup = true
      continue
    }
    inGroup = false
    const applies = currentAgents.some((a) => a === '*' || a.includes('siteclaritybot'))
    if (!applies) continue
    if (key === 'disallow' && value) rules.push({ allow: false, path: value })
    if (key === 'allow' && value) rules.push({ allow: true, path: value })
  }

  let best: { allow: boolean; path: string } | null = null
  for (const rule of rules) {
    if (!path.startsWith(rule.path)) continue
    if (!best || rule.path.length > best.path.length) best = rule
  }

  if (best && !best.allow) {
    return { allowed: false, reason: `robots.txt disallows ${best.path}` }
  }
  return { allowed: true, reason: null }
}
