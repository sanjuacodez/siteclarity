import { findHypeTerms } from '../static/lexicons/hype'
import type { Decision } from '../contracts'

/**
 * Tailored suggestions WITHOUT a generative model.
 *
 * Jev returns only schema values — it cannot write a sentence, and that limitation is
 * exactly what makes its output trustworthy. So specificity comes from two other places:
 *
 *   1. the offending words are extracted deterministically from the page, so advice can
 *      name them instead of saying "each superlative";
 *   2. Jev picks WHICH KIND of fix applies (a Choice question), and we render the
 *      pre-written template for that choice.
 *
 * The result is advice tailored to the passage, assembled entirely from templates and
 * real page text. Nothing is generated.
 */

const FIX_TEMPLATES: Record<string, { lead: string; detail: string }> = {
  add_a_number: {
    lead: 'Replace at least one with a figure',
    detail: 'how many, how much, how fast, or compared to what.',
  },
  state_the_limit: {
    lead: 'Say what it does not do',
    detail: 'saying who it is not for builds more trust than another superlative.',
  },
  cite_evidence: {
    lead: 'Point at the proof',
    detail: 'a test result, a case study, a doc page, or a named customer.',
  },
  give_an_example: {
    lead: 'Add one concrete example',
    detail: 'a real situation where this is used beats a general description.',
  },
  define_the_term: {
    lead: 'Define the term where it first appears',
    detail: 'one sentence, so a newcomer is not left guessing.',
  },
  already_specific: {
    lead: 'Tighten the wording',
    detail: 'the facts are there — the sales language is getting in the way.',
  },
}

function quoteList(terms: string[]): string {
  const q = terms.map((t) => `“${t}”`)
  if (q.length === 1) return q[0]!
  if (q.length === 2) return `${q[0]} and ${q[1]}`
  return `${q.slice(0, -1).join(', ')} and ${q[q.length - 1]}`
}

/** Suggestion for a section that reads as promotion. */
export function suggestForPromotional(
  text: string,
  improvement?: Decision,
): string | null {
  const matches = findHypeTerms(text, 4)
  const fixKey =
    improvement && improvement.kind === 'choice' ? String(improvement.value) : undefined
  const fix = (fixKey && FIX_TEMPLATES[fixKey]) || FIX_TEMPLATES.add_a_number!

  if (matches.length === 0) {
    return `${fix.lead} — ${fix.detail}`
  }

  const terms = quoteList(matches.map((m) => m.term))
  const noun = matches.length === 1 ? 'this word' : 'these words'
  return `Uses ${terms}. ${fix.lead} — ${fix.detail} Nobody can check ${noun}, and AI tools have nothing to quote.`
}

/** Suggestion for a passage carrying a vague claim. */
export function suggestForVagueClaim(
  text: string,
  improvement?: Decision,
): string | null {
  const matches = findHypeTerms(text, 3)
  const fixKey =
    improvement && improvement.kind === 'choice' ? String(improvement.value) : undefined
  const fix = (fixKey && FIX_TEMPLATES[fixKey]) || FIX_TEMPLATES.add_a_number!

  if (matches.length === 0) {
    return `${fix.lead} — ${fix.detail}`
  }
  return `Rests on ${quoteList(matches.map((m) => m.term))}. ${fix.lead} — ${fix.detail}`
}

export const SUGGESTERS: Record<
  string,
  (text: string, improvement?: Decision) => string | null
> = {
  heavily_promotional: suggestForPromotional,
  vague_claim: suggestForVagueClaim,
}
