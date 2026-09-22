import type { DecideRequest, DecideResponse, DecisionBackend } from './types'
import { BackendUnavailable } from './types'
import { validateResponse } from './validate'

/**
 * Laya — Convai Innovations' open-weight System One model (Apache-2.0).
 *
 * Verified against the published API 2026-09-23. It is NOT wire-compatible with
 * TypeSafe's `/v1/systemone`, which is why it needs its own adapter:
 *
 *   endpoint  POST {base}/ai/run
 *   request   { model, input: { state, questions } }   <- note the `input` wrapper
 *   response  { model, answers, usage }                <- same shape as Jev
 *
 * The answer shape matching Jev is what lets everything upstream stay unchanged;
 * only the envelope differs.
 *
 * Context is much smaller than Jev's 32k — the English checkpoint is 512 tokens with
 * roughly 320 for the state, multilingual and typed-decisions 1024. Scope-partitioned
 * state already keeps section states near 300 tokens, which is why this fits at all;
 * `LAYA_STATE_BUDGET` below is what callers should size against.
 */

/** Usable state budget for a local Laya checkpoint, in tokens. */
export const LAYA_STATE_BUDGET = 320

export const LAYA_MODELS = [
  'laya',                  // auto-selects a checkpoint by language
  'laya/english',
  'laya/multilingual',
  'laya/typed-decisions',
] as const

export class LayaBackend implements DecisionBackend {
  readonly name = 'laya' as const

  constructor(
    private readonly opts: {
      baseUrl: string
      model?: string
      apiKey?: string
      timeoutMs?: number
    },
  ) {}

  async decide(req: DecideRequest): Promise<DecideResponse> {
    const url = `${this.opts.baseUrl.replace(/\/$/, '')}/ai/run`

    const headers: Record<string, string> = { 'content-type': 'application/json' }
    // Self-hosted Laya usually runs without auth; a hosted one may not.
    if (this.opts.apiKey) headers.authorization = `Bearer ${this.opts.apiKey}`

    let res: Response
    try {
      res = await fetch(url, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          model: this.opts.model || 'laya',
          // Laya nests these under `input`; Jev takes them at the top level.
          input: { state: req.state, questions: req.questions },
        }),
        // Cold start on a self-hosted checkpoint can take a while, but a Worker
        // cannot wait the documented 150s, so fail fast and degrade visibly.
        signal: AbortSignal.timeout(this.opts.timeoutMs ?? 25_000),
      })
    } catch (e) {
      const msg = (e as Error).message
      throw new BackendUnavailable(
        /timeout|abort/i.test(msg)
          ? 'Laya did not respond in time — a cold start can take up to two minutes'
          : `request failed: ${msg}`,
      )
    }

    if (res.status === 401 || res.status === 403) throw new BackendUnavailable('unauthorized')
    if (res.status === 429) throw new BackendUnavailable('rate limited')
    if (res.status === 404) {
      throw new BackendUnavailable(`no /ai/run endpoint at ${this.opts.baseUrl}`)
    }
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300)
      if (/max_tokens_exceeded/.test(body)) {
        // Laya rejects oversized input rather than truncating it, which is the right
        // behaviour and worth surfacing plainly.
        throw new BackendUnavailable('state too large for this Laya checkpoint')
      }
      throw new BackendUnavailable(`HTTP ${res.status}: ${body}`)
    }

    return validateResponse(await res.json(), this.opts.model || 'laya')
  }
}
