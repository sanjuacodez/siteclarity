/**
 * SC-108 — one interface for typed decisions, several backends.
 *
 * System One models evaluate a STATE against typed QUESTIONS and return decisions
 * software can act on. They do not generate text — which is why invariant 1
 * ("evidence is never model-authored") is structural here rather than merely tested.
 *
 * Jev, Kev and Decider share TypeSafe's `POST /v1/systemone` wire format, so switching
 * between them is a base-URL change. Laya has its own interface and is translated here.
 */

export interface NoulQuestion {
  type: 'noul'
  instructions: string
  criteria: { true: string; false: string }
}

export interface ChoiceQuestion {
  type: 'choice'
  instructions: string
  /** Max 255 options (API limit). */
  criteria: Record<string, string>
}

export interface ScoreQuestion {
  type: 'score'
  instructions: string
  /** Ordered rubric levels, max 10 (API limit). */
  criteria: string[]
}

export type Question = NoulQuestion | ChoiceQuestion | ScoreQuestion

export interface Answer {
  type: 'noul' | 'choice' | 'score'
  noul?: number
  choice?: string
  score?: number
  probabilities?: Record<string, number>
  legend?: Record<string, string>
  confidence: number
}

export interface DecideRequest {
  /** Plain string or structured object. Must fit the model's context budget. */
  state: string | Record<string, unknown>
  questions: Record<string, Question>
}

export interface DecideResponse {
  model: string
  answers: Record<string, Answer>
  usage: { inputTokens: number; outputTokens: number }
}

export interface DecisionBackend {
  readonly name: 'workersai' | 'systemone' | 'replay'
  decide(req: DecideRequest): Promise<DecideResponse>
}

export class BackendUnavailable extends Error {
  constructor(readonly reason: string) {
    super(`Decision backend unavailable: ${reason}`)
  }
}
