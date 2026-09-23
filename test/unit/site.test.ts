import { describe, it, expect } from 'vitest'
import { readSiteSignals, buildSiteState, MIN_PAGES } from '../../src/semantic/site'
import { topicTerms, buildPageSummary, inventoryTokens } from '../../src/semantic/inventory'
import { extract } from '../../src/extract/extract'
import type { PageSummary } from '../../src/contracts'

const summary = (o: Partial<PageSummary> = {}): PageSummary => ({
  url: 'https://e.com/a', title: 'A page', purpose: 'sell', businessType: 'saas',
  topicTerms: ['checkout', 'fields'], audienceNamed: false, hasAction: true,
  findingCounts: { count: 2, high: 0 }, ...o,
})

describe('page summaries stay small enough to send', () => {
  it('keeps 25 pages well inside a decision model context', () => {
    const inventory = Array.from({ length: 25 }, (_, i) =>
      summary({ url: `https://e.com/${i}`, title: `Page number ${i} about checkout fields` }))
    // Jev is 32k; a local Laya checkpoint allows roughly 320 tokens of state. The
    // state sent is smaller still, since it carries titles and topics only.
    expect(inventoryTokens(inventory)).toBeLessThan(4000)
    const stateTokens = Math.ceil(JSON.stringify(buildSiteState(inventory)).length / 3.5)
    expect(stateTokens).toBeLessThan(1200)
  })

  it('draws topic terms from headings, not body prose', async () => {
    const doc = await extract(
      `<!doctype html><html lang="en"><head><title>Checkout fields for WooCommerce</title></head>
       <body><h1>Conditional checkout fields</h1><h2>Validation rules</h2>
       <p>${'filler word '.repeat(40)}</p></body></html>`,
      'https://e.com/')
    const terms = topicTerms(doc)
    expect(terms).toContain('checkout')
    expect(terms).toContain('field')       // stemmed
    expect(terms).not.toContain('filler')  // body prose is not a topic signal
    expect(terms.length).toBeLessThanOrEqual(8)
  })

  it('drops stopwords that could not indicate overlap', async () => {
    const doc = await extract(
      '<!doctype html><html lang="en"><head><title>How to use the best guide</title></head><body><h1>What is this</h1></body></html>',
      'https://e.com/')
    for (const noise of ['how', 'the', 'best', 'what', 'this', 'use']) {
      expect(topicTerms(doc), `"${noise}" is not a topic`).not.toContain(noise)
    }
  })
})

describe('site signals are counted, not judged', () => {
  it('counts audiences, actions and purposes across pages', () => {
    const s = readSiteSignals([
      summary({ audienceNamed: true, purpose: 'sell' }),
      summary({ audienceNamed: false, hasAction: false, purpose: 'sell' }),
      summary({ audienceNamed: null, purpose: 'explain' }),
    ])
    expect(s.pages).toBe(3)
    expect(s.audienceNamed).toBe(1)      // null is unknown, not a yes
    expect(s.withoutAction).toBe(1)
    expect(s.purposes).toEqual({ sell: 2, explain: 1 })
  })

  it('reports a shared topic only when three or more pages use it', () => {
    const two = readSiteSignals([
      summary({ topicTerms: ['checkout'] }),
      summary({ topicTerms: ['checkout'] }),
    ])
    expect(two.sharedTopics).toEqual([])

    const three = readSiteSignals([
      summary({ topicTerms: ['checkout'] }),
      summary({ topicTerms: ['checkout'] }),
      summary({ topicTerms: ['checkout', 'vat'] }),
    ])
    expect(three.sharedTopics).toEqual([{ term: 'checkout', pages: 3 }])
  })

  it('counts a term once per page however often it repeats', () => {
    const s = readSiteSignals([
      summary({ topicTerms: ['checkout', 'checkout', 'checkout'] }),
      summary({ topicTerms: ['checkout'] }),
      summary({ topicTerms: ['checkout'] }),
    ])
    expect(s.sharedTopics[0]).toEqual({ term: 'checkout', pages: 3 })
  })

  it('needs enough pages for coverage to mean anything', () => {
    expect(MIN_PAGES).toBeGreaterThanOrEqual(3)
  })
})

describe('site state carries summaries, never pages', () => {
  it('sends titles and topics only', () => {
    const state = buildSiteState([summary({ title: 'Pricing' })]) as {
      pages: { title: string; purpose: string; topics: string[] }[]
    }
    const serialised = JSON.stringify(state)
    expect(state.pages[0]!.title).toBe('Pricing')
    // No passage text, no findings, no evidence — those would blow the context.
    expect(serialised).not.toContain('findingCounts')
    expect(serialised).not.toContain('businessType')
  })
})
