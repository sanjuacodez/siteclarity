import type { ExtractedDoc } from '../extract/extract'
import type { PageSummary } from '../contracts'

/**
 * Reducing a page to the values site-level modules need.
 *
 * Deliberately tiny. Twenty-five of these must fit inside a decision model's context,
 * and a local Laya checkpoint allows roughly 320 tokens of state — so this is typed
 * values and short terms, never sentences.
 */

/** Words that carry no topic, so they cannot indicate overlap between pages. */
const STOP = new Set([
  'the', 'and', 'for', 'with', 'from', 'that', 'this', 'your', 'our', 'you', 'are',
  'how', 'what', 'why', 'who', 'which', 'when', 'where', 'can', 'will', 'does', 'get',
  'all', 'new', 'best', 'top', 'more', 'about', 'into', 'out', 'use', 'using', 'guide',
])

/** How many terms describe one page. Enough to detect overlap, small enough to send. */
const MAX_TERMS = 8

/**
 * Topic terms from headings.
 *
 * Headings rather than body text because a heading is the author's own statement of
 * what a section is about, and because it keeps the term list short without having to
 * rank anything.
 */
export function topicTerms(doc: ExtractedDoc): string[] {
  const counts = new Map<string, number>()
  const source = [doc.title ?? '', ...doc.headings.map((h) => h.text)].join(' ')

  for (const raw of source.toLowerCase().match(/[\p{L}][\p{L}\p{N}'-]{2,}/gu) ?? []) {
    const term = raw.replace(/(ing|ed|es|s)$/, '')
    if (term.length < 3 || STOP.has(term)) continue
    counts.set(term, (counts.get(term) ?? 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, MAX_TERMS)
    .map(([term]) => term)
}

export function buildPageSummary(input: {
  doc: ExtractedDoc
  url: string
  purpose: string | null
  businessType: string | null
  audienceNamed: boolean | null
  hasAction: boolean
  journeyStage: string | null
  count: number
  high: number
  coverage: { raised: string[]; answered: string[] } | null
}): PageSummary {
  return {
    url: input.url,
    title: input.doc.title,
    purpose: input.purpose,
    businessType: input.businessType,
    topicTerms: topicTerms(input.doc),
    audienceNamed: input.audienceNamed,
    hasAction: input.hasAction,
    journeyStage: input.journeyStage,
    findingCounts: { count: input.count, high: input.high },
    coverage: input.coverage,
  }
}

/** Rough token cost of an inventory, for deciding whether it fits a model's context. */
export function inventoryTokens(summaries: PageSummary[]): number {
  return Math.ceil(JSON.stringify(summaries).length / 3.5)
}
