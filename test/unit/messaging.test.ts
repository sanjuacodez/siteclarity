import { describe, it, expect } from 'vitest'
import { extract } from '../../src/extract/extract'
import { analyseCtas } from '../../src/static/messaging/cta'
import { assembleStaticFindings } from '../../src/assemble/findings'

const page = (body: string) =>
  `<!doctype html><html lang="en"><head><title>Acme Checkout</title></head><body>${body}</body></html>`
const ctas = async (body: string) => analyseCtas(await extract(page(body), 'https://e.com/'))

describe('Module 3 — calls to action', () => {
  it('recognises an action link', async () => {
    const r = await ctas('<a href="/signup">Start your free trial</a>')
    expect(r.actions.map((a) => a.text)).toContain('Start your free trial')
    expect(r.noAction).toBe(false)
  })

  it('flags link text that says nothing', async () => {
    const r = await ctas('<p>Details <a href="/a">click here</a> and <a href="/b">read more</a>.</p>')
    expect(r.vague.map((v) => v.text)).toEqual(expect.arrayContaining(['click here', 'read more']))
  })

  it('does not mistake navigation for a missing action', async () => {
    // Nav links are neither actions nor vague CTAs; a nav-only page has no candidates.
    const r = await ctas('<a href="/">Home</a><a href="/blog">Blog</a><a href="/pricing">Pricing</a>')
    expect(r.vague).toHaveLength(0)
    expect(r.noAction).toBe(false)
  })

  it('reports no next step when links exist but none invite action', async () => {
    const r = await ctas('<p>See the <a href="/a">technical specification</a> or the <a href="/b">changelog</a>.</p>')
    expect(r.noAction).toBe(true)
  })

  it('stays silent on a page with no links at all', async () => {
    // A page with nothing to click is a different problem, not this check's business.
    expect((await ctas('<p>Just prose here, nothing to click at all.</p>')).noAction).toBe(false)
  })

  it('does not double-count the same link', async () => {
    const r = await ctas('<a href="/x">click here</a><a href="/x">click here</a>')
    expect(r.vague).toHaveLength(1)
  })

  it('ignores footer and nav regions', async () => {
    const r = await ctas('<footer><a href="/a">click here</a></footer><nav><a href="/b">read more</a></nav>')
    expect(r.vague).toHaveLength(0)
  })
})

describe('Module 3 — reaches the report', () => {
  it('attributes findings to the messaging module', async () => {
    const doc = await extract(page('<h1>Acme</h1><p>Read <a href="/a">click here</a> for details about the plugin.</p>'), 'https://e.com/p')
    const f = assembleStaticFindings(doc, 'https://e.com/p').find((x) => x.checkId === 'vague_cta')
    expect(f, 'no vague_cta finding').toBeTruthy()
    expect(f!.module).toBe('messaging')
    expect(f!.observation).toContain('click here')
    expect(f!.observation).not.toMatch(/\{\w+\}/)
    expect(f!.highlights).toContain('click here')
  })

  it('says nothing when the action is clear', async () => {
    const doc = await extract(page('<h1>Acme</h1><p>Ready when you are.</p><a href="/signup">Start your free trial</a>'), 'https://e.com/p')
    const ids = assembleStaticFindings(doc, 'https://e.com/p').map((f) => f.checkId)
    expect(ids).not.toContain('vague_cta')
    expect(ids).not.toContain('no_clear_action')
  })
})
