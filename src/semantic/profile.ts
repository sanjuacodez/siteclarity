import type { ExtractedDoc, Passage } from '../extract/extract'
import type { Question } from '../provider/types'
import type { ProfileDimension } from '../contracts'
import { estimateTokens } from '../lib/config'
import type { ScopedState } from './state'

/**
 * Module 4 — Website Understanding.
 *
 * The model SELECTS one of the page's own passages per dimension; it never writes a
 * description.
 *
 * Shortlisting is deterministic because handing over every passage would blow the state
 * budget, and a Choice is capped at 255 options regardless. A page states what it does
 * near the top, in prose rather than in a list item, so that is what the shortlist
 * favours — and module 1 separately reports the case where it is buried instead.
 */

/** How many passages the model chooses between. Small enough for a 512-token state. */
const SHORTLIST = 8
/** Below this a passage is a label or a fragment, not a statement about the business. */
const MIN_WORDS = 8
/** Above this it is a wall of text that would dominate the state. */
const MAX_WORDS = 60

/** The label used for "the page does not say this", in every Choice below. */
export const NOT_STATED = 'not_stated'

/**
 * Candidates, in page order: prose from the top of the document, trimmed to a length
 * that leaves the state small enough for a local Laya checkpoint.
 */
export function shortlistPassages(doc: ExtractedDoc, excluded: Set<string>): Passage[] {
  return doc.passages
    .filter((p) => !excluded.has(p.sectionId) && !doc.boilerplatePassageIds.has(p.id))
    .filter((p) => p.kind === 'paragraph' || p.kind === 'listitem')
    .filter((p) => {
      const n = p.text.split(/\s+/).length
      return n >= MIN_WORDS && n <= MAX_WORDS
    })
    .slice(0, SHORTLIST)
}

/** A closed taxonomy, so this dimension needs no passage and no generation. */
const BUSINESS_TYPES: Record<string, string> = {
  saas: 'Software sold as a subscription or licence.',
  ecommerce: 'Sells physical or digital goods directly.',
  agency: 'Sells services delivered by people — consulting, design, development.',
  marketplace: 'Connects buyers and sellers it does not employ.',
  publisher: 'Publishes articles, courses or media as its main offering.',
  tool_or_plugin: 'An add-on or extension for another platform.',
  nonprofit: 'A charity, community or public-interest organisation.',
  personal: 'A personal site, portfolio or CV.',
  [NOT_STATED]: 'The page does not make the kind of business clear.',
}

/**
 * Selection questions, built per page because the options are this page's passages.
 *
 * Each carries an explicit "not stated" option. A dimension the page never addresses
 * must be answerable as absent, or the model is forced to pick something wrong — and a
 * forced pick is indistinguishable from a fabrication to whoever reads it.
 */
export function buildProfileQuestions(candidates: Passage[]): Record<string, Question> {
  const options: Record<string, string> = {}
  candidates.forEach((p, i) => {
    // Truncated only for the option label; the quote itself is looked up by id later.
    options[`p${i + 1}`] = p.text.length > 180 ? `${p.text.slice(0, 180)}…` : p.text
  })
  options[NOT_STATED] = 'None of these states it.'

  const select = (instructions: string): Question => ({
    type: 'choice',
    instructions,
    criteria: options,
  })

  return {
    business_type: {
      type: 'choice',
      instructions: 'What kind of business or offering is this page for?',
      criteria: BUSINESS_TYPES,
    },
    what_it_does: select('Which of these sentences best says what this product or service does?'),
    who_its_for: select('Which of these sentences best says who this is for?'),
    /**
     * Calibration produced the corpus's only false positive here, at 1.00 confidence: a
     * feature sentence ("converts long forms into step-by-step flows") was picked as the
     * problem. It is easy to see why — a capability implies a difficulty. But a reader
     * looking for "is this for me?" needs the difficulty stated, not inferred, so the
     * question now says what a problem is NOT.
     */
    problem_solved: select(
      'Which sentence describes a difficulty the reader has — something that goes wrong, ' +
        'costs them time, or frustrates them — rather than a thing this product does? ' +
        'A capability is not a problem, even when it implies one.',
    ),
    differentiator: select(
      'Which sentence names something this does that alternatives do not, or a trade-off ' +
        'it deliberately makes? Praise every competitor could copy is not a difference.',
    ),
  }
}

/** One state carrying the shortlist, shared by every selection question. */
export function buildProfileState(
  doc: ExtractedDoc,
  url: string,
  candidates: Passage[],
): ScopedState<{ candidates: Passage[] }> {
  const state = {
    url,
    title: doc.title,
    meta_description: doc.metaDescription,
    sentences: candidates.map((p, i) => `p${i + 1}: ${p.text}`),
  }
  return {
    scope: 'page',
    refId: 'profile',
    state,
    estimatedTokens: estimateTokens(JSON.stringify(state)),
    meta: { candidates },
  }
}

export const DIMENSION_LABELS: Record<ProfileDimension, string> = {
  business_type: 'What kind of business this is',
  what_it_does: 'What it does',
  who_its_for: 'Who it is for',
  problem_solved: 'The problem it solves',
  differentiator: 'What makes it different',
}

/** Shown when the page does not state a dimension. Plain, and not a reprimand. */
export const ABSENT_REASONS: Record<ProfileDimension, string> = {
  business_type: 'Nothing on this page makes the kind of business clear.',
  what_it_does: 'No sentence on this page plainly says what it does.',
  who_its_for: 'No sentence on this page says who it is for.',
  problem_solved: 'No sentence on this page names the problem it solves.',
  differentiator: 'No sentence on this page says what makes it different.',
}

export const BUSINESS_TYPE_LABELS = BUSINESS_TYPES

/**
 * What each dimension asks of the page, for the checks page.
 *
 * The profile section used to render unlike every other section — a bare label and an
 * absent reason, where the rest show what is asked, why it matters and what to do. A
 * reader should not have to notice that this module is built differently; only that it
 * describes rather than faults.
 */
export const DIMENSION_DOCS: Record<
  ProfileDimension,
  { asks: string; whyItMatters: string; ifMissing: string }
> = {
  business_type: {
    asks: 'What kind of business or offering is this page for?',
    whyItMatters:
      'Everything else on the page is read against this. A reader who cannot tell whether they are looking at software, a service or a shop has to work the rest out from scratch.',
    ifMissing:
      'Say plainly what you are, early. One clause in the opening line is enough.',
  },
  what_it_does: {
    asks: 'Which sentence best says what this product or service does?',
    whyItMatters:
      'This is the sentence a search engine or AI assistant quotes when someone asks what you are. If no sentence says it, they quote something else — usually a claim or a call to action.',
    ifMissing:
      'Write one plain sentence describing what it does, and put it near the top.',
  },
  who_its_for: {
    asks: 'Which sentence best says who this is for?',
    whyItMatters:
      'A reader decides whether to keep reading by finding themselves on the page. Without that sentence they have to guess, and most guess wrong or leave.',
    ifMissing:
      'Name the reader — the role, the size of business, the situation. One sentence.',
  },
  problem_solved: {
    asks: 'Which sentence describes a difficulty the reader has, rather than a thing the product does?',
    whyItMatters:
      'People search for their problem long before they search for a product. A page that only lists capabilities is invisible to everyone still describing the difficulty.',
    ifMissing:
      'State what goes wrong today for the person you are writing for, before describing the fix.',
  },
  differentiator: {
    asks: 'Which sentence names something this does that alternatives do not, or a trade-off it makes?',
    whyItMatters:
      'Every competitor claims to be powerful and easy, so those words distinguish nothing. Without a specific difference a reader has no basis for choosing.',
    ifMissing:
      'Name one concrete difference, and be willing to state the trade-off that comes with it.',
  },
}
