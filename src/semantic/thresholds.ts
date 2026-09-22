import type { Answer } from '../provider/types'

/**
 * Per-primitive confidence thresholds (finding F28).
 *
 * A single global threshold penalised multi-option questions. `extraction_readiness`
 * answered `"buried"` CORRECTLY at 0.34 confidence and was discarded, because a
 * four-option Choice spreads probability across four outcomes and is structurally less
 * peaked than a two-way Noul.
 *
 * So the bar is set per primitive, in proportion to how much agreement each can express:
 *
 *   noul    a binary judgement; 0.6 means roughly 0.8/0.2 on the underlying value
 *   choice  scaled to the option count — meaningfully above chance, not near-certain
 *   score   an ordered rubric, where adjacent levels are a legitimate disagreement
 *
 * These are floors for REPORTING something, so they trade recall for precision on
 * purpose: a false positive costs more trust than a missed finding costs value. Any
 * change here must be re-checked with `npm run calibrate:live`, which fails the run if
 * false positives appear.
 */

/** A binary yes/no should be genuinely confident before it is acted on. */
export const NOUL_THRESHOLD = 0.6

/** An ordered rubric; neighbouring levels are a judgement call rather than an error. */
export const SCORE_THRESHOLD = 0.5

/**
 * Choice scales with the option count. With `n` options, chance is `1/n`; requiring
 * roughly double that keeps the answer meaningfully better than a guess without
 * demanding a certainty the primitive cannot express.
 *
 *   2 options -> 0.60    4 options -> 0.40    6 options -> 0.35
 */
export function choiceThreshold(optionCount: number): number {
  if (optionCount <= 2) return 0.6
  return Math.max(0.35, Math.min(0.6, 2 / optionCount))
}

/** How many options the model actually weighed, when it tells us. */
export function optionCount(answer: Answer): number {
  if (answer.probabilities) return Object.keys(answer.probabilities).length
  if (answer.legend) return Object.keys(answer.legend).length
  return 2
}

/**
 * The reporting bar for one answer. `fallback` is the configured global value, used for
 * `noul` so an operator can still tighten or loosen the product's overall caution.
 */
export function thresholdFor(answer: Answer, fallback: number): number {
  switch (answer.type) {
    case 'choice':
      return choiceThreshold(optionCount(answer))
    case 'score':
      return Math.min(SCORE_THRESHOLD, fallback)
    case 'noul':
    default:
      return fallback
  }
}
