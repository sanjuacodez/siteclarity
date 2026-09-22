import { describe, it, expect } from 'vitest'
import { normalizeUrl, guardUrl } from '../../src/intake/normalize'
import { MUST_REJECT, MUST_ACCEPT } from '../fixtures/ssrf-hosts'

describe('SC-103 SSRF guards', () => {
  for (const { url, why } of MUST_REJECT) {
    it(`rejects ${why}: ${url || '(empty)'}`, () => {
      const r = normalizeUrl(url)
      expect(r.ok, `ACCEPTED a URL that must be blocked (${why})`).toBe(false)
      if (!r.ok) expect(['invalid_url', 'blocked_url']).toContain(r.error.code)
    })
  }

  for (const url of MUST_ACCEPT) {
    it(`accepts public host: ${url}`, () => {
      const r = normalizeUrl(url)
      expect(r.ok, `BLOCKED a legitimate public URL`).toBe(true)
    })
  }

  it('normalises without changing the host', () => {
    const r = normalizeUrl('HTTPS://Example.COM/Path?a=1#frag')
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.url.hostname).toBe('example.com')
      expect(r.value.url.hash).toBe('')
      expect(r.value.url.pathname).toBe('/Path')   // path case preserved
      expect(r.value.url.search).toBe('?a=1')      // query preserved
    }
  })

  it('drops only default ports', () => {
    const a = normalizeUrl('https://example.com:443/')
    const b = normalizeUrl('https://example.com:8443/')
    if (a.ok) expect(a.value.url.port).toBe('')
    if (b.ok) expect(b.value.url.port).toBe('8443')
  })

  it('guardUrl blocks a redirect hop to a private address', () => {
    // fetchPage re-runs guardUrl on every hop; this is that check in isolation.
    expect(guardUrl(new URL('http://169.254.169.254/')).ok).toBe(false)
    expect(guardUrl(new URL('http://10.1.2.3/')).ok).toBe(false)
    expect(guardUrl(new URL('https://example.com/')).ok).toBe(true)
  })
})
