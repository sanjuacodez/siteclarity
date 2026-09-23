import type { ExtractedDoc, Passage } from '../extract/extract'
import { estimateTokens } from '../lib/config'
import type { ScopedState } from './state'
import type { Question } from '../provider/types'
import type { PageSummary } from '../contracts'
import type { StaticTemplate } from '../static/structure/templates'

/**
 * Module 5 — Customer question coverage.
 *
 * The brief asks us to "identify the questions customers are likely to ask", which is
 * writing sentences, and nothing here may write a sentence. So the questions are a
 * human-written bank kept in this file, quoted verbatim wherever they appear. See
 * docs/MODULE-5-DESIGN.md for why a bank beats the alternatives.
 *
 * The part that is genuinely per-page is not WHICH questions exist but whether this page
 * answers the ones it raises. A question is only put to the model when the page's own
 * text contains one of its trigger terms — so a blog post about API design is never
 * asked about refunds, and a page that says "affordable pricing" with no figure is.
 */

/** Areas from the product brief. Used to group the report, nothing else. */
export const COVERAGE_AREAS = {
  understanding: 'Product understanding',
  pricing: 'Pricing',
  suitability: 'Suitability',
  use_cases: 'Use cases',
  implementation: 'Implementation',
  comparison: 'Comparison',
  trust: 'Trust',
  security: 'Security',
  support: 'Support',
  purchase: 'Purchase decisions',
} as const
export type CoverageArea = keyof typeof COVERAGE_AREAS

export interface BankQuestion {
  /** Stable id. Appears in findings and in the checks page. */
  id: string
  area: CoverageArea
  /** The buyer's question, in their words. Quoted verbatim; never rewritten. */
  text: string
  /**
   * Terms whose presence means the page RAISES this question. Literal and lowercase —
   * synonyms are a maintenance job on this list, not a model call.
   */
  triggers: string[]
  /** Business types this applies to. Absent means all of them. */
  appliesTo?: string[]
  priority: 'high' | 'medium' | 'low'
}

/**
 * The bank. Deliberately small — roughly two per area.
 *
 * The brief's example reports 103 questions. A bank of 103 would mostly be filler, and
 * every filler question costs a decision and produces a finding somebody has to read.
 * A question belongs here when a buyer who cannot find the answer would leave.
 */
export const QUESTION_BANK: BankQuestion[] = [
  {
    id: 'q_what_is_it',
    area: 'understanding',
    text: 'What is this, in plain terms?',
    triggers: ['platform', 'product', 'software', 'service', 'tool', 'app', 'solution'],
    priority: 'high',
  },
  {
    id: 'q_what_problem',
    area: 'understanding',
    text: 'What problem does this solve for me?',
    triggers: ['problem', 'struggle', 'difficult', 'frustrat', 'waste', 'manual', 'error'],
    priority: 'high',
  },
  {
    id: 'q_what_it_costs',
    area: 'pricing',
    text: 'What does it cost?',
    triggers: ['pricing', 'price', 'cost', 'plan', 'subscription', 'fee', 'affordable', 'budget'],
    appliesTo: ['saas', 'ecommerce', 'agency', 'marketplace', 'tool_or_plugin', 'publisher'],
    priority: 'high',
  },
  {
    id: 'q_free_tier',
    area: 'pricing',
    text: 'Is there a free version or a trial, and what are its limits?',
    triggers: ['free', 'trial', 'freemium', 'demo', 'starter'],
    appliesTo: ['saas', 'tool_or_plugin', 'marketplace'],
    priority: 'medium',
  },
  {
    id: 'q_is_it_for_me',
    area: 'suitability',
    text: 'Is this meant for someone like me?',
    triggers: ['for teams', 'for businesses', 'designed for', 'built for', 'ideal for', 'suited'],
    priority: 'high',
  },
  {
    id: 'q_when_not_to_use',
    area: 'suitability',
    text: 'When is this the wrong choice?',
    triggers: ['limitation', 'not suitable', 'may not', 'is not for', 'drawback', 'trade-off'],
    priority: 'medium',
  },
  {
    id: 'q_what_can_i_do',
    area: 'use_cases',
    text: 'What would I actually use this for?',
    triggers: ['use case', 'example', 'workflow', 'scenario', 'for instance', 'such as'],
    priority: 'medium',
  },
  {
    id: 'q_how_to_start',
    area: 'implementation',
    text: 'How do I get started, and how long does it take?',
    triggers: ['setup', 'set up', 'install', 'onboard', 'get started', 'implementation', 'migrate'],
    priority: 'high',
  },
  {
    id: 'q_integrations',
    area: 'implementation',
    text: 'Does it work with what I already use?',
    triggers: ['integrat', 'api', 'plugin', 'connect', 'compatible', 'works with', 'export'],
    appliesTo: ['saas', 'tool_or_plugin', 'marketplace', 'agency'],
    priority: 'medium',
  },
  {
    id: 'q_vs_alternatives',
    area: 'comparison',
    text: 'How is this different from the alternatives?',
    triggers: ['alternative', 'competitor', 'unlike', 'compared', 'versus', ' vs ', 'other tools'],
    priority: 'high',
  },
  {
    id: 'q_who_uses_it',
    area: 'trust',
    text: 'Who else uses this, and did it work for them?',
    triggers: ['customer', 'client', 'trusted by', 'case study', 'testimonial', 'used by'],
    priority: 'medium',
  },
  {
    id: 'q_who_is_behind_it',
    area: 'trust',
    text: 'Who is behind this?',
    triggers: ['our team', 'founded', 'about us', 'we are a', 'company', 'founder'],
    priority: 'low',
  },
  {
    id: 'q_data_safety',
    area: 'security',
    text: 'What happens to my data?',
    triggers: ['data', 'privacy', 'gdpr', 'encrypt', 'secure', 'security', 'compliance', 'hosted'],
    appliesTo: ['saas', 'tool_or_plugin', 'marketplace', 'ecommerce'],
    priority: 'high',
  },
  {
    id: 'q_support',
    area: 'support',
    text: 'What help do I get if something goes wrong?',
    triggers: ['support', 'help', 'contact us', 'documentation', 'sla', 'response time'],
    priority: 'medium',
  },
  {
    id: 'q_next_step',
    area: 'purchase',
    text: 'What happens if I sign up — and can I stop?',
    triggers: ['sign up', 'signup', 'buy', 'checkout', 'cancel', 'refund', 'contract', 'commitment'],
    appliesTo: ['saas', 'ecommerce', 'marketplace', 'tool_or_plugin'],
    priority: 'medium',
  },
]

/** Cap per page. The questions ride in an existing call, but a Choice each still costs. */
export const MAX_QUESTIONS_PER_PAGE = 6

/**
 * Which bank questions this page RAISES.
 *
 * Deterministic: a literal term search over the page's own text. A question the page
 * never raises is not asked and produces no finding — a page is not at fault for being
 * about something else.
 */
export function selectCoverageQuestions(
  doc: ExtractedDoc,
  businessType: string | null,
  limit = MAX_QUESTIONS_PER_PAGE,
): BankQuestion[] {
  const haystack = pageText(doc)
  const rank = { high: 0, medium: 1, low: 2 }

  return QUESTION_BANK.filter((q) => appliesToType(q, businessType))
    .map((q) => ({ q, hits: q.triggers.filter((t) => haystack.includes(t)).length }))
    .filter((x) => x.hits > 0)
    .sort((a, b) => rank[a.q.priority] - rank[b.q.priority] || b.hits - a.hits)
    .slice(0, limit)
    .map((x) => x.q)
}

/** Unknown business type keeps every question: a guess should not silence a check. */
function appliesToType(q: BankQuestion, businessType: string | null): boolean {
  if (!q.appliesTo || !businessType) return true
  return q.appliesTo.includes(businessType)
}

/** Title, headings and passage text, lowercased, for trigger matching. */
function pageText(doc: ExtractedDoc): string {
  return [doc.title ?? '', doc.metaDescription ?? '', ...doc.headings.map((h) => h.text),
    ...doc.passages.map((p) => p.text)]
    .join(' ')
    .toLowerCase()
}

/**
 * One Choice per raised question.
 *
 * Three options, not the five of the frozen `CoverageLabel` vocabulary: `cannot_assess`
 * is what the confidence gate produces in code, and `conflicting` needs more than one
 * page. A Choice is only as good as the separation between its options, so the model is
 * given only the three it can actually decide between.
 */
export function buildCoverageQuestions(selected: BankQuestion[]): Record<string, Question> {
  const questions: Record<string, Question> = {}
  for (const q of selected) {
    questions[q.id] = {
      type: 'choice',
      // The bank question is quoted as the subject of the judgement. It is data.
      instructions: `A visitor asks: “${q.text}” Does this page answer that?`,
      criteria: {
        answers_it: 'Yes — the page states it plainly enough for the visitor to act on.',
        mentions_only:
          'The subject comes up, but after reading it the visitor still would not know the answer.',
        not_addressed: 'Nothing on this page speaks to it.',
      },
    }
  }
  return questions
}

/**
 * The whole bank as a question catalogue, for the checks page.
 *
 * Built from the same function the audit uses, so what is documented is exactly what is
 * asked — a hand-written copy would drift the first time a question was sharpened.
 */
export const COVERAGE_QUESTIONS_DOC: Record<string, Question> =
  buildCoverageQuestions(QUESTION_BANK)

export const COVERAGE_LOOKUP: Record<string, BankQuestion> = Object.fromEntries(
  QUESTION_BANK.map((q) => [q.id, q]),
)

/**
 * Page-level finding copy.
 *
 * Only one, and only for the raised-and-unanswered case. A page is not obliged to answer
 * every question, so "this page does not cover security" is not a claim worth making;
 * "this page brings up security and leaves the reader without an answer" is.
 */
export const COVERAGE_TEMPLATES: Record<string, StaticTemplate> = {
  question_raised_unanswered: {
    priority: 'high',
    pageLevel: true,
    observation: 'This page raises “{question}” without answering it.',
    whyItMatters:
      'Bringing the subject up and leaving it open is worse than silence: the reader now has the question in mind and no way to resolve it here. An AI assistant asked the same thing will quote whichever site did answer it.',
    recommendedAction:
      'Answer it where you raise it — the figure, the limit, the timeframe. If it genuinely belongs elsewhere, link straight to the answer rather than to a section.',
  },
}

/**
 * Site-level finding copy, from the roll-up.
 *
 * One template, not two. "Nothing on this site addresses X" was also a finding, and it
 * made module 5 five of the seven findings in the site block — a list of things you have
 * not written, which is the advice this module exists to replace. Those rows stay in the
 * coverage table marked *not addressed*, where they inform without demanding anything.
 */
export const COVERAGE_SITE_TEMPLATES: Record<string, StaticTemplate> = {
  question_unanswered_sitewide: {
    priority: 'high',
    pageLevel: true,
    observation: '“{question}” comes up on {pages}, and is answered on none.',
    whyItMatters:
      'The subject runs through the site without ever being settled. Someone comparing options has to ask you directly or assume the worst, and an assistant answering for them has nothing here to quote.',
    recommendedAction:
      'Answer it once, properly, on the page where it most belongs, and point the others at it.',
  },
}

export type CoverageStatus = 'answered' | 'unanswered' | 'absent'

export interface CoverageRow {
  id: string
  area: CoverageArea
  text: string
  priority: 'high' | 'medium' | 'low'
  status: CoverageStatus
  /** Pages that raised the question; the first answering page comes first. */
  pages: string[]
}

/**
 * The roll-up: set arithmetic over what each page raised and answered.
 *
 * Decisions are local; aggregation is deterministic code. Nothing is re-read and no
 * model is called here.
 */
export function rollUpCoverage(summaries: PageSummary[]): CoverageRow[] {
  const applicable = new Set(
    summaries.flatMap((s) =>
      QUESTION_BANK.filter((q) => appliesToType(q, s.businessType)).map((q) => q.id),
    ),
  )

  return QUESTION_BANK.filter((q) => applicable.has(q.id)).map((q) => {
    const answered = summaries.filter((s) => s.coverage?.answered.includes(q.id))
    const raised = summaries.filter((s) => s.coverage?.raised.includes(q.id))
    const status: CoverageStatus = answered.length
      ? 'answered'
      : raised.length
        ? 'unanswered'
        : 'absent'
    return {
      id: q.id,
      area: q.area,
      text: q.text,
      priority: q.priority,
      status,
      pages: [...answered, ...raised.filter((s) => !answered.includes(s))].map((s) => s.url),
    }
  })
}
/** Passages to carry, and how much text. Small enough for a local Laya checkpoint. */
const MAX_STATE_PASSAGES = 14
const MAX_STATE_CHARS = 1800

/**
 * Coverage gets its own state rather than riding in the page-scope call.
 *
 * The page state carries the title, the headings and the opening 1,200 characters —
 * enough for "what is this page for", nowhere near enough for "does it say what it
 * costs", because the price is usually halfway down. Judging coverage from the opening
 * would report questions as unanswered while their answers sat in the text, which is
 * exactly the kind of false claim this product cannot afford to make.
 *
 * So the state is the passages that raised the questions, plus the passage either side
 * of each, plus the opening of any section whose HEADING raised one. Both neighbours
 * matter: a heading says "Simple pricing" and the figure lands under it in a sentence
 * that contains no trigger term at all.
 */
export function buildCoverageState(
  doc: ExtractedDoc,
  selected: BankQuestion[],
): ScopedState<{ passageIds: string[] }> {
  const triggers = selected.flatMap((q) => q.triggers)
  const raises = (text: string) => {
    const lower = text.toLowerCase()
    return triggers.some((t) => lower.includes(t))
  }
  const index = new Map(doc.passages.map((p, i) => [p.id, i]))
  const keep = new Set<number>()

  doc.passages.forEach((p, i) => {
    if (!raises(p.text)) return
    keep.add(i)
    if (i > 0) keep.add(i - 1)
    if (i + 1 < doc.passages.length) keep.add(i + 1)
  })

  // A heading is the author's own statement of what follows, so a heading that raises a
  // question means the answer, if there is one, is in the text under it.
  for (const section of doc.sections) {
    if (!section.heading || !raises(section.heading)) continue
    for (const id of section.passageIds.slice(0, 3)) {
      const i = index.get(id)
      if (i !== undefined) keep.add(i)
    }
  }

  const chosen: Passage[] = []
  let chars = 0
  for (const i of [...keep].sort((a, b) => a - b)) {
    const passage = doc.passages[i]
    if (!passage) continue
    if (chosen.length >= MAX_STATE_PASSAGES || chars + passage.text.length > MAX_STATE_CHARS) break
    chosen.push(passage)
    chars += passage.text.length
  }

  const state = {
    url: doc.canonical ?? '',
    title: doc.title,
    // Headings give the model the shape of the page, so an answer it cannot see is
    // recognisable as living elsewhere rather than as missing.
    headings: doc.headings.slice(0, 25).map((h) => h.text),
    relevant_text: chosen.map((p) => p.text),
  }

  return {
    scope: 'page',
    refId: 'coverage',
    state,
    estimatedTokens: estimateTokens(JSON.stringify(state)),
    meta: { passageIds: chosen.map((p) => p.id) },
  }
}
