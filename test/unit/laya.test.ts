import { describe, it, expect, vi, afterEach } from 'vitest'
import { LayaBackend, LAYA_STATE_BUDGET } from '../../src/provider/laya'
import { BackendUnavailable } from '../../src/provider/types'
import { validateBackendUrl } from '../../src/intake/normalize'

const req = { state: { text: 'x' }, questions: { q: { type: 'noul' as const, instructions: 'i', criteria: { true: 't', false: 'f' } } } }
const reply = (body: unknown, status = 200) =>
  vi.fn(async () => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))

afterEach(() => vi.unstubAllGlobals())

describe('Laya adapter', () => {
  it('posts to /ai/run with state and questions nested under input', async () => {
    const f = reply({ model: 'laya-0.3.4/typed-decisions', answers: { q: { type: 'noul', noul: 0.79 } }, usage: { input_tokens: 90, output_tokens: 0 } })
    vi.stubGlobal('fetch', f)
    await new LayaBackend({ baseUrl: 'https://laya.example.com/' }).decide(req)

    const [url, init] = f.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://laya.example.com/ai/run')   // not /v1/systemone
    const body = JSON.parse(String(init.body))
    expect(body.input.state).toEqual(req.state)           // the wrapper Jev does not use
    expect(body.input.questions).toEqual(req.questions)
    expect(body.state).toBeUndefined()
  })

  it('derives confidence for a noul answer, which Laya also omits', async () => {
    vi.stubGlobal('fetch', reply({ answers: { q: { type: 'noul', noul: 0.79 } } }))
    const res = await new LayaBackend({ baseUrl: 'https://l.test' }).decide(req)
    expect(res.answers.q!.confidence).toBeCloseTo(0.58, 2)
  })

  it('passes a model through and defaults to laya', async () => {
    const f = reply({ answers: {} })
    vi.stubGlobal('fetch', f)
    await new LayaBackend({ baseUrl: 'https://l.test' }).decide(req)
    expect(JSON.parse(String((f.mock.calls[0] as [string, RequestInit])[1].body)).model).toBe('laya')

    const g = reply({ answers: {} })
    vi.stubGlobal('fetch', g)
    await new LayaBackend({ baseUrl: 'https://l.test', model: 'laya/multilingual' }).decide(req)
    expect(JSON.parse(String((g.mock.calls[0] as [string, RequestInit])[1].body)).model).toBe('laya/multilingual')
  })

  it('reports an oversized state plainly — Laya rejects rather than truncating', async () => {
    vi.stubGlobal('fetch', reply({ error: 'max_tokens_exceeded' }, 400))
    await expect(new LayaBackend({ baseUrl: 'https://l.test' }).decide(req))
      .rejects.toThrow(/state too large/i)
  })

  it('degrades rather than throwing an opaque error on a wrong URL', async () => {
    vi.stubGlobal('fetch', reply({}, 404))
    await expect(new LayaBackend({ baseUrl: 'https://l.test' }).decide(req))
      .rejects.toBeInstanceOf(BackendUnavailable)
  })

  it('explains a cold-start timeout', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('The operation was aborted due to timeout') }))
    await expect(new LayaBackend({ baseUrl: 'https://l.test' }).decide(req))
      .rejects.toThrow(/cold start/i)
  })

  it('keeps a state budget small enough for a local checkpoint', () => {
    // English Laya is 512 tokens total with ~320 for state; scoped section states
    // measured ~293, which is why this fits at all.
    expect(LAYA_STATE_BUDGET).toBeLessThanOrEqual(320)
  })
})

describe('caller-supplied server URL is untrusted', () => {
  it('blocks private and loopback hosts by default', () => {
    for (const bad of ['http://127.0.0.1:8000', 'http://localhost:8000', 'http://169.254.169.254',
                       'http://10.0.0.5', 'file:///etc/passwd', 'http://user:pw@example.com']) {
      expect(validateBackendUrl(bad, false).ok, `accepted ${bad}`).toBe(false)
    }
  })

  it('allows them only when a deployment opts in, for local development', () => {
    expect(validateBackendUrl('http://localhost:8000', true).ok).toBe(true)
    expect(validateBackendUrl('http://127.0.0.1:8000', false).ok).toBe(false)
  })

  it('accepts a public server and normalises the trailing slash', () => {
    const r = validateBackendUrl('https://laya.example.com/', false)
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value).toBe('https://laya.example.com')
  })
})
