import { err, ok, type Result } from '../lib/errors'

/**
 * SC-103 — URL normalisation and SSRF guards.
 *
 * This is the security boundary of the product: every byte analysed downstream
 * enters here. A Worker has no LAN and no instance-metadata endpoint, which makes
 * SSRF materially less dangerous than on a self-hosted box — but input is still
 * validated, and every redirect hop is re-checked (see fetch.ts).
 */

const ALLOWED_PROTOCOLS = new Set(['http:', 'https:'])

/** Hostnames that must never be fetched, matched case-insensitively. */
const BLOCKED_HOSTNAMES = new Set([
  'localhost',
  'localhost.localdomain',
  'ip6-localhost',
  'ip6-loopback',
  'metadata.google.internal',
])

const BLOCKED_SUFFIXES = ['.local', '.internal', '.localhost', '.home.arpa', '.onion']

/** Decimal, octal, hex and dotted-quad IPv4 in any of the forms a parser accepts. */
function parseIPv4(host: string): number[] | null {
  const parts = host.split('.')
  if (parts.length > 4 || parts.length === 0) return null

  const nums: number[] = []
  for (const part of parts) {
    if (part === '') return null
    let n: number
    if (/^0[xX][0-9a-fA-F]+$/.test(part)) n = parseInt(part, 16)
    else if (/^0[0-7]+$/.test(part)) n = parseInt(part, 8)
    else if (/^\d+$/.test(part)) n = parseInt(part, 10)
    else return null
    if (!Number.isFinite(n) || n < 0) return null
    nums.push(n)
  }

  // A bare integer such as 2130706433 is a valid IPv4 address.
  if (nums.length === 1) {
    const n = nums[0]!
    if (n > 0xffffffff) return null
    return [(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]
  }
  if (nums.length !== 4 || nums.some((n) => n > 255)) return null
  return nums
}

function isPrivateIPv4(octets: number[]): boolean {
  const [a = 0, b = 0] = octets
  return (
    a === 0 ||                          // 0.0.0.0/8
    a === 10 ||                         // private
    a === 127 ||                        // loopback
    (a === 169 && b === 254) ||         // link-local / cloud metadata
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 100 && b >= 64 && b <= 127) || // CGNAT
    a >= 224                            // multicast + reserved
  )
}

function isBlockedIPv6(host: string): boolean {
  const h = host.replace(/^\[|\]$/g, '').toLowerCase()
  if (h === '::1' || h === '::' ) return true
  if (h.startsWith('fe80') || h.startsWith('fc') || h.startsWith('fd')) return true
  // IPv4-mapped, e.g. ::ffff:127.0.0.1
  const mapped = h.match(/::ffff:(.+)$/)
  if (mapped?.[1]) {
    const v4 = parseIPv4(mapped[1])
    if (v4 && isPrivateIPv4(v4)) return true
  }
  return false
}

export interface NormalizedUrl {
  url: URL
  href: string
}

export function normalizeUrl(input: string): Result<NormalizedUrl> {
  const trimmed = input.trim()
  if (!trimmed) return err('invalid_url', 'URL is empty')

  // Bare hostnames are a common paste; default them to https.
  const candidate = /^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed) ? trimmed : `https://${trimmed}`

  let url: URL
  try {
    url = new URL(candidate)
  } catch {
    return err('invalid_url', `Not a valid URL: ${input}`)
  }

  const guard = guardUrl(url)
  if (!guard.ok) return guard

  url.hash = ''
  url.hostname = url.hostname.toLowerCase()
  if ((url.protocol === 'https:' && url.port === '443') ||
      (url.protocol === 'http:' && url.port === '80')) {
    url.port = ''
  }

  return ok({ url, href: url.toString() })
}

/**
 * Validate a decision-model server URL supplied by the caller's browser.
 *
 * This is a genuine SSRF vector: the visitor tells our Worker which host to POST to.
 * The same host rules as page fetching apply, so a hosted instance cannot be used to
 * probe private space.
 *
 * `allowPrivate` exists for local development, where a self-hosted Laya or Kev really
 * does live on localhost and the Worker really is on the same machine. It defaults to
 * off and must be turned on deliberately.
 */
export function validateBackendUrl(
  raw: string,
  allowPrivate: boolean,
): Result<string> {
  const trimmed = raw.trim()
  if (!trimmed) return err('invalid_url', 'Server URL is empty')

  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    return err('invalid_url', 'Server URL is not a valid URL')
  }
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return err('blocked_url', 'Server URL must use http or https')
  }
  if (url.username || url.password) {
    return err('blocked_url', 'Server URL must not embed credentials')
  }
  if (allowPrivate) return ok(url.origin + url.pathname.replace(/\/$/, ''))

  const guard = guardUrl(url)
  if (!guard.ok) return guard
  return ok(url.origin + url.pathname.replace(/\/$/, ''))
}

/** Applied to the initial URL and again to every redirect hop. */
export function guardUrl(url: URL): Result<true> {
  if (!ALLOWED_PROTOCOLS.has(url.protocol)) {
    return err('blocked_url', `Protocol not allowed: ${url.protocol}`)
  }

  // Credentials in the authority are a classic way to disguise the real host.
  if (url.username || url.password) {
    return err('blocked_url', 'URLs with embedded credentials are not allowed')
  }

  const host = url.hostname.toLowerCase().replace(/\.$/, '')
  if (!host) return err('invalid_url', 'URL has no host')

  if (BLOCKED_HOSTNAMES.has(host)) {
    return err('blocked_url', `Host not allowed: ${host}`)
  }
  if (BLOCKED_SUFFIXES.some((s) => host.endsWith(s))) {
    return err('blocked_url', `Host suffix not allowed: ${host}`)
  }
  if (host.startsWith('[') || host.includes(':')) {
    if (isBlockedIPv6(host)) return err('blocked_url', `Private IPv6 address: ${host}`)
    return err('blocked_url', 'IP literals are not allowed; use a hostname')
  }

  const v4 = parseIPv4(host)
  if (v4) {
    if (isPrivateIPv4(v4)) return err('blocked_url', `Private IP address: ${host}`)
    return err('blocked_url', 'IP literals are not allowed; use a hostname')
  }

  return ok(true)
}
