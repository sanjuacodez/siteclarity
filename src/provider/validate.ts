import { z } from 'zod'
import type { DecideResponse } from './types'
import { BackendUnavailable } from './types'

/**
 * Every backend response is validated before it reaches the rest of the system.
 * A malformed answer degrades to `cannot_assess` upstream — never repaired, never guessed.
 *
 * Verified against the live Jev 1.13.0 API on 2026-09-22. Two shape facts that are
 * easy to get wrong and were only visible from a real call:
 *
 *  1. `noul` answers carry NO `confidence` field. The value itself is the signal:
 *     0.96 is a confident yes, 0.04 a confident no, 0.5 maximal uncertainty. We
 *     derive confidence as |value - 0.5| * 2 so one threshold works across all
 *     three primitives.
 *  2. `score` is a probability-weighted index over the rubric (0-based), not a
 *     rating out of anything. A 0.48 against a five-level rubric sits between
 *     level 0 and level 1 — it is NOT "48%", and must never be rendered as one.
 */
const AnswerSchema = z.object({
  type: z.enum(['noul', 'choice', 'score']),
  noul: z.number().min(0).max(1).optional(),
  choice: z.string().optional(),
  score: z.number().optional(),
  probabilities: z.record(z.number()).optional(),
  legend: z.record(z.string()).optional(),
  confidence: z.number().min(0).max(1).optional(),
})

const ResponseSchema = z.object({
  model: z.string().optional(),
  answers: z.record(AnswerSchema),
  usage: z
    .object({
      input_tokens: z.number().nonnegative().optional(),
      output_tokens: z.number().nonnegative().optional(),
    })
    .optional(),
})

export function validateResponse(raw: unknown, fallbackModel = 'unknown'): DecideResponse {
  const parsed = ResponseSchema.safeParse(raw)
  if (!parsed.success) {
    throw new BackendUnavailable(
      `malformed response: ${parsed.error.issues.map((i) => i.path.join('.')).join(', ')}`,
    )
  }
  const { model, answers, usage } = parsed.data

  const normalized: DecideResponse['answers'] = {}
  for (const [id, a] of Object.entries(answers)) {
    normalized[id] = {
      ...a,
      confidence: a.confidence ?? deriveNoulConfidence(a.noul),
    }
  }

  return {
    model: model ?? fallbackModel,
    answers: normalized,
    usage: {
      inputTokens: usage?.input_tokens ?? 0,
      outputTokens: usage?.output_tokens ?? 0,
    },
  }
}

/** A noul at 0.5 is maximally uncertain; at 0 or 1 it is maximally confident. */
export function deriveNoulConfidence(noul: number | undefined): number {
  if (noul === undefined) return 0
  return Math.min(1, Math.abs(noul - 0.5) * 2)
}
