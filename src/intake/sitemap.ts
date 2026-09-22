import { guardUrl, normalizeUrl } from './normalize'
import { err, ok, type Result } from '../lib/errors'
import { USER_AGENT } from './fetch'
import type { Config } from '../lib/config'

/**
 * Sitemap discovery.
 *
 * Returns URLs only — it does NOT analyse them. On the free tier a multi-page scan
 * cannot run inside one invocation: ten pages of extraction is roughly 80 ms of CPU
 * against a 10 ms limit. So the browser drives the loop, calling /api/analyze once per
 * URL, and each page gets its own invocation and its own budget. That also gives live
 * progress for free.
 */

export interface SitemapResult {
  sitemapUrl: string
  urls: string[]
  totalFound: number
  truncated: boolean
  viaRobots: boolean
}

const MAX_SITEMAP_BYTES = 3_000_000
const MAX_CHILD_SITEMAPS = 5

export async function discoverUrls(
  siteUrl: URL,
  config: Config,
  limit: number,
): Promise<Result<SitemapResult>> {
  const candidates: { url: string; viaRobots: boolean }[] = []

  const fromRobots = await sitemapFromRobots(siteUrl, config)
  for (const u of fromRobots) candidates.push({ url: u, viaRobots: true })
  candidates.push({ url: new URL('/sitemap.xml', siteUrl).toString(), viaRobots: false })
  candidates.push({ url: new URL('/sitemap_index.xml', siteUrl).toString(), viaRobots: false })

  for (const candidate of candidates) {
    const xml = await fetchText(candidate.url, config)
    if (!xml) continue

    const parsed = parseSitemap(xml)
    let urls = parsed.urls

    // A sitemap index points at child sitemaps rather than pages.
    if (parsed.kind === 'index') {
      urls = []
      for (const child of parsed.urls.slice(0, MAX_CHILD_SITEMAPS)) {
        const childXml = await fetchText(child, config)
        if (!childXml) continue
        urls.push(...parseSitemap(childXml).urls)
        if (urls.length >= limit * 4) break
      }
    }

    const sameHost = dedupe(urls)
      .filter((u) => sameOrigin(u, siteUrl))
      .filter((u) => !isAsset(u))

    if (sameHost.length === 0) continue

    return ok({
      sitemapUrl: candidate.url,
      urls: sameHost.slice(0, limit),
      totalFound: sameHost.length,
      truncated: sameHost.length > limit,
      viaRobots: candidate.viaRobots,
    })
  }

  return err('fetch_failed', 'No sitemap found. Try analysing a single page instead.')
}

async function sitemapFromRobots(siteUrl: URL, config: Config): Promise<string[]> {
  const text = await fetchText(new URL('/robots.txt', siteUrl).toString(), config)
  if (!text) return []
  return [...text.matchAll(/^\s*sitemap:\s*(\S+)/gim)]
    .map((m) => m[1])
    .filter((v): v is string => Boolean(v))
    .slice(0, 3)
}

async function fetchText(url: string, config: Config): Promise<string | null> {
  let target: URL
  try {
    target = new URL(url)
  } catch {
    return null
  }
  if (!guardUrl(target).ok) return null

  try {
    const res = await fetch(target.toString(), {
      headers: { 'user-agent': USER_AGENT },
      signal: AbortSignal.timeout(config.fetchTimeoutMs),
    })
    if (!res.ok) return null
    const len = Number(res.headers.get('content-length') ?? '0')
    if (len > MAX_SITEMAP_BYTES) return null
    const text = await res.text()
    return text.length > MAX_SITEMAP_BYTES ? null : text
  } catch {
    return null
  }
}

/** Regex rather than a parser: sitemaps are flat and this stays inside the CPU budget. */
export function parseSitemap(xml: string): { kind: 'index' | 'urlset'; urls: string[] } {
  const kind = /<sitemapindex[\s>]/i.test(xml) ? 'index' : 'urlset'
  const urls = [...xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)]
    .map((m) => decodeXml((m[1] ?? '').trim()))
    .filter(Boolean)
  return { kind, urls }
}

const decodeXml = (s: string) =>
  s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')

function sameOrigin(candidate: string, site: URL): boolean {
  const n = normalizeUrl(candidate)
  if (!n.ok) return false
  return n.value.url.hostname.replace(/^www\./, '') === site.hostname.replace(/^www\./, '')
}

const ASSET = /\.(jpe?g|png|gif|webp|svg|pdf|zip|mp4|mp3|css|js|xml|json)(\?|$)/i
const isAsset = (u: string) => ASSET.test(u)

function dedupe(urls: string[]): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const u of urls) {
    const key = u.replace(/\/$/, '').toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(u)
  }
  return out
}
