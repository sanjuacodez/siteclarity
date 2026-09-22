import { describe, it, expect } from 'vitest'
import { analyseBurial, topicTerms } from '../../src/static/language/burial'

describe('F29 deterministic burial detection', () => {
  it('finds the answer behind three sentences of preamble', () => {
    // The exact case the model could not decide: "ready" at 0.39, "buried" at 0.34.
    const r = analyseBurial('Does it work with WooCommerce?',
      'Compatibility is a topic we get asked about constantly, and it is worth explaining ' +
      'our philosophy first. We believe plugins should be good citizens and never fight ' +
      'the host platform, which has guided every decision we have made since 2019. ' +
      'Yes, Acme Checkout works with WooCommerce 7.0 and later.')
    expect(r.buried).toBe(true)
    expect(r.answerSentence).toBe(2)
    expect(r.wordsBefore).toBeGreaterThan(25)
    expect(r.preamble).toContain('philosophy')
  })

  it('leaves an answer that comes first alone', () => {
    const r = analyseBurial('What browsers are supported?',
      'Acme Checkout supports Chrome, Firefox, Safari and Edge. We test each release ' +
      'against the last two versions of every browser. Older browsers may work but are ' +
      'not covered by support.')
    expect(r.buried).toBe(false)
    expect(r.answerSentence).toBe(0)
  })

  it('says nothing about a short section', () => {
    // Two sentences cannot bury anything; flagging them would be noise.
    expect(analyseBurial('Is there a free trial?',
      'No. Acme Checkout has no free trial, but every licence is refundable for 30 days.').buried)
      .toBe(false)
  })

  it('stays silent when the heading has too few topic words', () => {
    expect(analyseBurial('Why?', 'Because of this. And that. And the other thing entirely.').buried).toBe(false)
    expect(analyseBurial('How it works', 'One thing. Two things. Three things happen here.').answerSentence)
      .toBe(-1)
  })

  it('leaves a section that never addresses its heading to answer_absent', () => {
    // Nothing was buried — nothing was there. Different finding, different check.
    const r = analyseBurial('What does it cost?',
      'We started this company in a garage. Our team is spread across four countries. ' +
      'Everything we build begins with a conversation about craft.')
    expect(r.answerSentence).toBe(-1)
    expect(r.buried).toBe(false)
  })

  it('matches across simple word endings', () => {
    expect(topicTerms('Which payment gateways are supported?')).toEqual(
      expect.arrayContaining(['payment', 'gateway', 'support']),
    )
    const r = analyseBurial('Which payment gateways are supported?',
      'Let us begin by describing our overall integration philosophy in some detail here. ' +
      'It has evolved considerably over many years of shipping to merchants worldwide. ' +
      'Acme supports the Stripe payment gateway, PayPal, Adyen and Mollie.')
    expect(r.buried).toBe(true)
  })

  it('is deterministic', () => {
    const args: [string, string] = ['What is the price?',
      'Pricing is something we thought hard about for a long time before launching. ' +
      'We wanted it simple and fair for stores of every size across the world. ' +
      'The price is 49 dollars per year.']
    expect(analyseBurial(...args)).toEqual(analyseBurial(...args))
  })
})

describe('burial reaches the report', () => {
  it('produces a finding through the real assembly path', async () => {
    const { extract } = await import('../../src/extract/extract')
    const { assembleStaticFindings } = await import('../../src/assemble/findings')
    const html = `<!doctype html><html lang="en"><head><title>Acme Checkout pricing</title>
      <meta name="description" content="d"><link rel="canonical" href="https://e.com/p"></head><body>
      <h1>Acme Checkout</h1>
      <h2>Does it work with WooCommerce?</h2>
      <p>Compatibility is a topic we get asked about constantly, and it is worth explaining our
      philosophy first before anything else.</p>
      <p>We believe plugins should be good citizens and never fight the host platform, which has
      guided every decision we have made since 2019.</p>
      <p>Yes, Acme Checkout works with WooCommerce 7.0 and later.</p>
      </body></html>`
    const doc = await extract(html, 'https://e.com/p')
    const findings = assembleStaticFindings(doc, 'https://e.com/p')
    const buried = findings.find((f) => f.checkId === 'answer_buried_positional')

    expect(buried, 'burial finding never reached the report').toBeTruthy()
    expect(buried!.observation).toContain('WooCommerce')
    expect(buried!.observation).toMatch(/\d+ words/)
    expect(buried!.evidence.length).toBeGreaterThan(0)
    expect(buried!.confidence).toBe('high')   // measured, not judged
    // No unfilled slots.
    expect(buried!.recommendedAction).not.toMatch(/\{\w+\}/)
  })

  it('stays quiet on a page that answers its headings promptly', async () => {
    const { extract } = await import('../../src/extract/extract')
    const { assembleStaticFindings } = await import('../../src/assemble/findings')
    const html = `<!doctype html><html lang="en"><head><title>Acme Checkout</title></head><body>
      <h1>Acme</h1>
      <h2>Does it work with WooCommerce?</h2>
      <p>Yes, Acme Checkout works with WooCommerce 7.0 and later.</p>
      <p>We test every release against the two most recent WooCommerce versions.</p>
      <p>Older versions may work but are not covered by support.</p>
      </body></html>`
    const doc = await extract(html, 'https://e.com/p')
    expect(assembleStaticFindings(doc, 'https://e.com/p').map((f) => f.checkId))
      .not.toContain('answer_buried_positional')
  })
})
