import type { Config, AppEnv } from '../lib/config'
import type { DecisionBackend } from './types'
import { WorkersAIBackend } from './workersai'
import { SystemOneBackend } from './systemone'
import { ReplayBackend } from './replay'
import { LayaBackend } from './laya'

export * from './types'
export { fixtureKey } from './replay'
export { LAYA_MODELS, LAYA_STATE_BUDGET } from './laya'

/**
 * Backend selection is configuration only — no call site knows which model is in use.
 * That is what makes Jev ↔ Kev ↔ Decider ↔ Laya a base-URL change (SC-108).
 */
export function createBackend(env: AppEnv, config: Config): DecisionBackend {
  switch (config.backend) {
    case 'replay':
      return new ReplayBackend()
    case 'laya':
      return new LayaBackend({
        // Validated upstream; a caller-supplied URL is untrusted input.
        baseUrl: config.systemOneBaseUrl ?? 'http://localhost:8000',
        model: config.model,
        apiKey: config.jevApiKey,
      })
    case 'systemone':
      return new SystemOneBackend({
        baseUrl: config.systemOneBaseUrl,
        apiKey: config.jevApiKey,
        model: config.model,
      })
    case 'workersai':
    default:
      return new WorkersAIBackend(env.AI)
  }
}
