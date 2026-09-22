import { describe, it, expect } from 'vitest'
import { readCallerKey, withCallerKey, loadConfig } from '../../src/lib/config'
import { AppError, redactSecrets } from '../../src/lib/errors'

const base = () => loadConfig({ DECISION_BACKEND: 'workersai' })

describe('bring-your-own key', () => {
  it('accepts a plausible key and switches to the direct API', () => {
    const key = 'jevtok_' + 'a1b2c3d4e5'.repeat(4)
    const cfg = withCallerKey(base(), readCallerKey(key))
    expect(cfg.backend).toBe('systemone')
    expect(cfg.jevApiKey).toBe(key)
  })

  it('ignores absent, short or malformed keys rather than trying them', () => {
    for (const bad of [null, '', '   ', 'short', 'has spaces in it ' + 'x'.repeat(30),
                       'has<angle>brackets' + 'x'.repeat(30), 'x'.repeat(500)]) {
      expect(readCallerKey(bad as string | null), `accepted: ${String(bad).slice(0, 24)}`).toBeNull()
    }
  })

  it('leaves config untouched when no key is supplied', () => {
    const cfg = base()
    expect(withCallerKey(cfg, null)).toEqual(cfg)
  })

  it('never lets a credential reach a response body', () => {
    const key = 'jev_' + 'k'.repeat(40)
    const err = new AppError('fetch_failed', `Upstream rejected Bearer ${key}`)
    const body = JSON.stringify(err.toJSON())
    expect(body).not.toContain(key)
    expect(body).toContain('[redacted]')
  })

  it('redacts keys in query strings and common prefixes', () => {
    expect(redactSecrets('https://x.test/v1?api_key=abc123secret&z=1')).toContain('[redacted]')
    expect(redactSecrets('https://x.test/v1?api_key=abc123secret&z=1')).toContain('&z=1')
    expect(redactSecrets('token sk_live_' + 'q'.repeat(30))).toContain('[redacted]')
  })

  it('leaves ordinary error text alone', () => {
    const msg = 'Expected HTML, got "application/pdf"'
    expect(redactSecrets(msg)).toBe(msg)
  })
})
