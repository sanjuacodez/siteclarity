/**
 * SC-111 — the check catalogue: how a typed decision becomes a human finding.
 *
 * Copy is TEMPLATED, never model-authored (AGENTS.md invariant 1). Findings come from
 * a fixed catalogue, so slots filled from deterministic data plus typed decisions are
 * entirely sufficient — and the result is deterministic, unit-testable and translatable.
 *
 * Every template answers three questions the reader actually has:
 *   what is true  ->  observation
 *   why care      ->  whyItMatters
 *   what do I do  ->  recommendedAction
 */
import type { Decision } from '../contracts'

export type Trigger = (dec: Decision) => boolean

/**
 * A heading only makes a promise if it reads as a question or a topic. Review blocks
 * headed by a username, and one-word labels like "Home", promise nothing — flagging
 * them for "not answering" is noise, and noise is what this product exists to avoid.
 */
export function headingIsPromissory(label: string | null): boolean {
  if (!label) return false
  const t = label.trim()
  if (t.length < 4) return false
  if (/[?]/.test(t)) return true
  const words = t.split(/\s+/)
  if (words.length < 2) return false
  // A run of capitalised words with no lowercase connective reads as a name.
  if (words.length <= 3 && /^[A-Z][a-z]+(\s[A-Z][a-z]+){1,2}$/.test(t)) return false
  return true
}

export interface CheckDef {
  id: string
  scope: 'page' | 'section' | 'passage'
  /** When set, the check only applies to sections whose heading promises something. */
  requiresPromissoryHeading?: boolean
  /** Which decision in the catalogue this check reads. */
  questionId: string
  /** Fires a finding when true. */
  triggers: Trigger
  priority: 'high' | 'medium' | 'low'
  /** `{label}` is the section heading or page title. */
  observation: string
  whyItMatters: string
  recommendedAction: string
}

const noulBelow = (t: number): Trigger => (d) => d.kind === 'noul' && d.value < t
const choiceIn = (...vals: string[]): Trigger => (d) =>
  d.kind === 'choice' && vals.includes(String(d.value))
const scoreAtLeast = (t: number): Trigger => (d) => d.kind === 'score' && d.value >= t

export const CHECKS: CheckDef[] = [
  {
    id: 'heading_not_answered',
    scope: 'section',
    requiresPromissoryHeading: true,
    questionId: 'answers_heading',
    triggers: noulBelow(0.4),
    priority: 'high',
    observation: '“{label}” does not answer its own heading.',
    whyItMatters:
      'Google and AI tools pull the text sitting right under a heading. If the heading asks one thing and the text below answers something else, they skip it — even if the answer is further down the page.',
    recommendedAction:
      'Answer the heading in the first sentence or two. Add the detail after that.',
  },
  {
    id: 'not_self_contained',
    scope: 'section',
    questionId: 'self_contained',
    triggers: noulBelow(0.4),
    priority: 'medium',
    observation: '“{label}” only makes sense if you have read the rest of the page.',
    whyItMatters:
      'AI tools quote one section at a time, without the rest of the page. Words like “it”, “this” and “as mentioned above” have nothing to point at once the section is on its own, so it gets skipped.',
    recommendedAction:
      'Say the actual name instead of “it” or “this”. Make sure the section reads fine on its own.',
  },
  {
    id: 'answer_buried',
    scope: 'section',
    requiresPromissoryHeading: true,
    questionId: 'extraction_readiness',
    triggers: choiceIn('buried'),
    priority: 'high',
    observation: 'The answer in “{label}” is buried too far down.',
    whyItMatters:
      'The answer is there, but it takes digging to find. Pages that put the answer in the first line get quoted instead of yours.',
    recommendedAction:
      'Move the answer to the top. Put background, exceptions and selling points underneath.',
  },
  {
    id: 'answer_absent',
    scope: 'section',
    requiresPromissoryHeading: true,
    questionId: 'extraction_readiness',
    triggers: choiceIn('absent'),
    priority: 'high',
    observation: '“{label}” has a heading but no real answer under it.',
    whyItMatters:
      'A heading tells readers and AI what to expect. When nothing useful follows it, visitors leave and AI tools have nothing to quote.',
    recommendedAction:
      'Either write a real answer under this heading, or delete the heading.',
  },
  {
    id: 'needs_context',
    scope: 'section',
    requiresPromissoryHeading: true,
    questionId: 'extraction_readiness',
    triggers: choiceIn('needs_context'),
    priority: 'low',
    observation: '“{label}” has the answer, but only if you read what comes before it.',
    whyItMatters:
      'On its own it would confuse someone, so AI tools are less likely to use it — even though what it says is correct.',
    recommendedAction:
      'Add one short sentence at the start explaining what this is about.',
  },
  {
    id: 'heavily_promotional',
    scope: 'section',
    questionId: 'promotional_intensity',
    triggers: scoreAtLeast(2.5),
    priority: 'medium',
    observation: '“{label}” sounds like an advert instead of giving facts.',
    whyItMatters:
      'Words like “best” and “world-class” are not facts. There is nothing here an AI tool can quote, and nothing a reader can check.',
    recommendedAction:
      'Swap each of these words for the fact behind it — a number, a limit, or a real example.',
  },
  {
    id: 'entity_unclear',
    scope: 'page',
    questionId: 'entity_clarity',
    triggers: noulBelow(0.5),
    priority: 'high',
    observation: 'The page never says what it is actually about.',
    whyItMatters:
      'Saying only “we” or “our platform” leaves search engines and AI tools unable to work out which product or company this is.',
    recommendedAction:
      'Put the product or company name in the first paragraph and in at least one heading.',
  },
  {
    id: 'vague_claim',
    scope: 'passage',
    questionId: 'claim_specificity',
    triggers: (d) => d.kind === 'score' && d.value < 1.5,
    priority: 'low',
    observation: 'This claim is too vague to check.',
    whyItMatters:
      'A claim with no numbers cannot be checked by a reader or quoted by an AI tool. It adds words without adding trust.',
    recommendedAction:
      'Add a number or a source. What was measured, and compared to what?',
  },
]

export const CHECKS_BY_QUESTION = CHECKS.reduce<Record<string, CheckDef[]>>((acc, c) => {
  ;(acc[c.questionId] ??= []).push(c)
  return acc
}, {})
