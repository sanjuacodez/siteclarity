import type { DecideRequest, DecideResponse, DecisionBackend } from './types'
import { BackendUnavailable } from './types'
import { validateResponse } from './validate'

/**
 * TypeSafe System One wire format: POST /v1/systemone.
 *
 * Covers Jev (hosted), and self-hosted Kev and Decider unchanged — point `baseUrl`
 * at a local server and the rest of the system is unaffected.
 */
export class SystemOneBackend implements DecisionBackend {
  readonly name = 'systemone' as const

  constructor(
    private readonly opts: {
      baseUrl?: string
      apiKey?: string
      model: string
      timeoutMs?: number
    },
  ) {}

  async decide(req: DecideRequest): Promise<DecideResponse> {
    const base = this.opts.baseUrl ?? 'https://api.typesafe.ai'
    const url = `${base.replace(/\/$/, '')}/v1/systemone`

    const headers: Record<string, string> = { 'content-type': 'application/json' }
    // Self-hosted Kev / Decider commonly run without auth.
    if (this.opts.apiKey) headers.authorization = `Bearer ${this.opts.apiKey}`

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          state: req.state,
          model: this.opts.model,
          questions: req.questions,
        }),
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 20_000),
      })
    } catch (e) {
      throw new BackendUnavailable(`request failed: ${(e as Error).message}`)
    }

    if (res.status === 401) throw new BackendUnavailable('unauthorized (check JEV_API_KEY)')
    if (res.status === 429) throw new BackendUnavailable('rate limited')
    if (res.status === 529) throw new BackendUnavailable('overloaded')
    if (res.status === 422) {
      throw new BackendUnavailable(`invalid request: ${(await res.text()).slice(0, 300)}`)
    }
    if (!res.ok) {
      throw new BackendUnavailable(`HTTP ${res.status}: ${(await res.text()).slice(0, 300)}`)
    }

    return validateResponse(await res.json())
  }
}
