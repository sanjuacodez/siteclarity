import type { DecisionBackend, Question, Answer } from '../provider/types'
import { BackendUnavailable } from '../provider/types'
import type { ScopedState } from './state'
import { logger } from '../lib/logger'

export interface DecisionOutcome {
  refId: string
  scope: ScopedState['scope']
  answers: Record<string, Answer>
}

export interface RunStats {
  calls: number
  inputTokens: number
  outputTokens: number
  model: string | null
  degraded: boolean
  degradedReason: string | null
}

/**
 * One call per state, bounded concurrency.
 *
 * Deliberately NOT one call per page: each question gets the narrowest state that can
 * answer it (see state.ts). Calls are network-bound, so they cost ~0 against the 10 ms
 * CPU budget and run concurrently in well under a second.
 */
export async function runDecisions(
  backend: DecisionBackend,
  states: ScopedState<unknown>[],
  questions: Record<string, Question>,
  maxConcurrent: number,
): Promise<{ outcomes: DecisionOutcome[]; stats: RunStats }> {
  const outcomes: DecisionOutcome[] = []
  const stats: RunStats = {
    calls: 0,
    inputTokens: 0,
    outputTokens: 0,
    model: null,
    degraded: false,
    degradedReason: null,
  }

  if (states.length === 0 || Object.keys(questions).length === 0) {
    return { outcomes, stats }
  }

  const queue = [...states]
  const workers = Array.from({ length: Math.min(maxConcurrent, queue.length) }, async () => {
    while (queue.length > 0) {
      // Once the backend is known to be down, stop issuing calls rather than
      // burning the remaining budget on requests that will fail the same way.
      if (stats.degraded) return
      const item = queue.shift()
      if (!item) return

      try {
        const res = await backend.decide({ state: item.state, questions })
        stats.calls++
        stats.inputTokens += res.usage.inputTokens
        stats.outputTokens += res.usage.outputTokens
        stats.model ??= res.model
        outcomes.push({ refId: item.refId, scope: item.scope, answers: res.answers })
      } catch (e) {
        if (e instanceof BackendUnavailable) {
          stats.degraded = true
          stats.degradedReason = e.reason
          logger.warn('decision backend degraded', { reason: e.reason })
          return
        }
        throw e
      }
    }
  })

  await Promise.all(workers)
  return { outcomes, stats }
}

/**
 * Confidence gate. Below the threshold the answer is discarded rather than reported —
 * `cannot_assess` is a first-class outcome and is always preferable to a guess.
 */
export function isConfident(answer: Answer, threshold: number): boolean {
  return answer.confidence >= threshold
}
