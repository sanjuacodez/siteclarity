import type { DecideRequest, DecideResponse, DecisionBackend } from './types'

/**
 * Recorded responses, keyed by a hash of the request. The default in tests so a
 * contributor can clone, `npm test`, and get a green run with no key and no cost
 * (see CONTRIBUTING.md).
 *
 * Fixtures must be RECORDED, never hand-written — a hand-written "realistic"
 * response encodes our expectations instead of the model's actual behaviour.
 */
export class ReplayBackend implements DecisionBackend {
  readonly name = 'replay' as const

  constructor(private readonly fixtures: Record<string, DecideResponse> = {}) {}

  async decide(req: DecideRequest): Promise<DecideResponse> {
    const key = fixtureKey(req)
    const hit = this.fixtures[key]
    if (hit) return hit

    // No fixture: answer every question at zero confidence, which upstream turns
    // into `cannot_assess`. Deterministic, and never invents a decision.
    const answers: DecideResponse['answers'] = {}
    for (const [id, q] of Object.entries(req.questions)) {
      answers[id] =
        q.type === 'noul'
          ? { type: 'noul', noul: 0.5, confidence: 0 }
          : q.type === 'choice'
            ? { type: 'choice', choice: Object.keys(q.criteria)[0] ?? '', confidence: 0 }
            : { type: 'score', score: 0, confidence: 0 }
    }
    return { model: 'replay', answers, usage: { inputTokens: 0, outputTokens: 0 } }
  }
}

export function fixtureKey(req: DecideRequest): string {
  const state = typeof req.state === 'string' ? req.state : JSON.stringify(req.state)
  const qids = Object.keys(req.questions).sort().join(',')
  let h = 0x811c9dc5
  const input = `${state}|${qids}`
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}
