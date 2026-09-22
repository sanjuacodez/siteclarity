import type { DecideRequest, DecideResponse, DecisionBackend } from './types'
import { BackendUnavailable } from './types'
import { validateResponse } from './validate'

/**
 * Jev through the Cloudflare Workers AI binding (`typesafe/jev`).
 *
 * This is the default backend: no API key, and covered by the free daily neuron
 * allowance. Per-call neuron cost is not yet measured — see SC-108 handoff notes.
 */
export class WorkersAIBackend implements DecisionBackend {
  readonly name = 'workersai' as const

  constructor(
    private readonly ai: { run: (model: string, input: unknown) => Promise<unknown> } | undefined,
    private readonly model = 'typesafe/jev',
  ) {}

  async decide(req: DecideRequest): Promise<DecideResponse> {
    if (!this.ai) throw new BackendUnavailable('AI binding not configured')

    let raw: unknown
    try {
      raw = await this.ai.run(this.model, {
        state: req.state,
        questions: req.questions,
      })
    } catch (e) {
      throw new BackendUnavailable(`Workers AI call failed: ${(e as Error).message}`)
    }

    return validateResponse(raw, this.model)
  }
}
