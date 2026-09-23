import { describe, it, expect } from 'vitest'
import { findOverlaps } from '../../src/semantic/site'
import type { PageSummary } from '../../src/contracts'

const page = (o: Partial<PageSummary>): PageSummary => ({
  url: 'https://e.com/a', title: 'A', purpose: 'explain', businessType: 'saas',
  topicTerms: [], audienceNamed: null, hasAction: true, journeyStage: 'education',
  findingCounts: { count: 0, high: 0 }, ...o,
})

describe('Module 9 — content overlap', () => {
  it('reports two pages covering the same ground', () => {
    const pairs = findOverlaps([
      page({ url: 'https://e.com/1', title: 'Checkout fields guide', topicTerms: ['checkout', 'field', 'validation', 'woocommerce'] }),
      page({ url: 'https://e.com/2', title: 'How to add checkout fields', topicTerms: ['checkout', 'field', 'validation', 'store'] }),
    ])
    expect(pairs).toHaveLength(1)
    expect(pairs[0]!.shared).toEqual(expect.arrayContaining(['checkout', 'field', 'validation']))
  })

  it('needs the same buying stage — a guide and a pricing page are not rivals', () => {
    expect(findOverlaps([
      page({ url: 'https://e.com/1', journeyStage: 'education', topicTerms: ['checkout', 'field', 'validation'] }),
      page({ url: 'https://e.com/2', journeyStage: 'decision', topicTerms: ['checkout', 'field', 'validation'] }),
    ])).toEqual([])
  })

  it('needs the same purpose — explaining and selling are different jobs', () => {
    expect(findOverlaps([
      page({ url: 'https://e.com/1', purpose: 'explain', topicTerms: ['checkout', 'field', 'validation'] }),
      page({ url: 'https://e.com/2', purpose: 'sell', topicTerms: ['checkout', 'field', 'validation'] }),
    ])).toEqual([])
  })

  it('ignores shared vocabulary that every page on a site uses', () => {
    // Two terms in common is what any two pages of one site have.
    expect(findOverlaps([
      page({ url: 'https://e.com/1', topicTerms: ['checkout', 'woocommerce', 'pricing', 'refund'] }),
      page({ url: 'https://e.com/2', topicTerms: ['checkout', 'woocommerce', 'shipping', 'tax'] }),
    ])).toEqual([])
  })

  it('does not compare a page with itself', () => {
    const one = page({ url: 'https://e.com/1', topicTerms: ['checkout', 'field', 'validation', 'rule'] })
    expect(findOverlaps([one])).toEqual([])
  })

  it('stays silent when a page has no stage or purpose to match on', () => {
    expect(findOverlaps([
      page({ url: 'https://e.com/1', journeyStage: null, topicTerms: ['checkout', 'field', 'validation'] }),
      page({ url: 'https://e.com/2', journeyStage: null, topicTerms: ['checkout', 'field', 'validation'] }),
    ])).toEqual([])
  })

  it('caps how many pairs it reports', () => {
    const many = Array.from({ length: 10 }, (_, i) =>
      page({ url: `https://e.com/${i}`, topicTerms: ['checkout', 'field', 'validation', 'rule'] }))
    // 10 identical pages is 45 pairs; a report listing all of them is unusable.
    expect(findOverlaps(many).length).toBeLessThanOrEqual(5)
  })

  it('orders by how much the pages overlap', () => {
    const pairs = findOverlaps([
      page({ url: 'https://e.com/1', topicTerms: ['checkout', 'field', 'validation', 'rule'] }),
      page({ url: 'https://e.com/2', topicTerms: ['checkout', 'field', 'validation', 'rule'] }),
      page({ url: 'https://e.com/3', topicTerms: ['checkout', 'field', 'validation', 'tax'] }),
    ])
    expect(pairs.length).toBeGreaterThan(1)
    expect(pairs[0]!.ratio).toBeGreaterThanOrEqual(pairs[1]!.ratio)
  })

  it('is cheap enough for the CPU budget it was designed around', () => {
    // Embeddings were ruled out by the 10 ms limit; set intersection is the whole point.
    const many = Array.from({ length: 25 }, (_, i) =>
      page({ url: `https://e.com/${i}`, topicTerms: [`t${i}`, 'checkout', 'field', 'rule'] }))
    const t0 = Date.now()
    findOverlaps(many)
    expect(Date.now() - t0).toBeLessThan(5)
  })
})
