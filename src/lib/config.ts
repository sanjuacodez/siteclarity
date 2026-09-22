import { z } from 'zod'

/** Cloudflare bindings and vars. Validated once per request; never read process.env. */
export interface AppEnv {
  AI?: { run: (model: string, input: unknown) => Promise<unknown> }
  DECISION_BACKEND?: string
  DECISION_MODEL?: string
  MAX_PAGE_BYTES?: string
  MAX_REDIRECTS?: string
  FETCH_TIMEOUT_MS?: string
  MAX_CONCURRENT_DECISIONS?: string
  CONFIDENCE_THRESHOLD?: string
  STATE_TOKEN_BUDGET?: string
  MAX_SECTIONS?: string
  MIN_SECTION_WORDS?: string
  JEV_API_KEY?: string
  SYSTEMONE_BASE_URL?: string
}

const numeric = (fallback: number) =>
  z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? fallback : Number(v)))
    .pipe(z.number().finite().positive())

const ConfigSchema = z.object({
  backend: z.enum(['workersai', 'systemone', 'replay']).default('workersai'),
  model: z.string().min(1).default('jev-latest'),
  maxPageBytes: numeric(300_000),
  maxRedirects: numeric(5),
  fetchTimeoutMs: numeric(10_000),
  maxConcurrentDecisions: numeric(14),
  confidenceThreshold: z
    .string()
    .optional()
    .transform((v) => (v === undefined || v === '' ? 0.6 : Number(v)))
    .pipe(z.number().min(0).max(1)),
  stateTokenBudget: numeric(24_000),
  maxSections: numeric(40),
  minSectionWords: numeric(12),
  jevApiKey: z.string().optional(),
  systemOneBaseUrl: z.string().url().optional(),
})

export type Config = z.infer<typeof ConfigSchema>

/**
 * Parse config from bindings. Fails loudly on malformed values rather than
 * silently defaulting — a wrong threshold should not be discoverable only in output.
 */
export function loadConfig(env: AppEnv): Config {
  return ConfigSchema.parse({
    backend: env.DECISION_BACKEND || undefined,
    model: env.DECISION_MODEL || undefined,
    maxPageBytes: env.MAX_PAGE_BYTES,
    maxRedirects: env.MAX_REDIRECTS,
    fetchTimeoutMs: env.FETCH_TIMEOUT_MS,
    maxConcurrentDecisions: env.MAX_CONCURRENT_DECISIONS,
    confidenceThreshold: env.CONFIDENCE_THRESHOLD,
    stateTokenBudget: env.STATE_TOKEN_BUDGET,
    maxSections: env.MAX_SECTIONS,
    minSectionWords: env.MIN_SECTION_WORDS,
    jevApiKey: env.JEV_API_KEY || undefined,
    systemOneBaseUrl: env.SYSTEMONE_BASE_URL || undefined,
  })
}

/**
 * Rough token estimate. Workers has no cheap tokenizer, and this only needs to
 * be conservative enough to keep states inside budget with headroom.
 * ~4 chars/token for English prose; we deliberately round up.
 */
/**
 * Apply a caller-supplied Jev key to the config for one request.
 *
 * This is the bring-your-own-key path that makes a public deployment possible: each
 * visitor uses their own TypeSafe account rather than the operator's quota.
 *
 * The key is used for the lifetime of one request and then discarded. It is never
 * written to storage, never logged, and never echoed back in a response — see the
 * redaction in `src/lib/errors.ts`.
 */
export function withCallerKey(config: Config, key: string | null): Config {
  if (!key) return config
  return { ...config, backend: 'systemone', jevApiKey: key }
}

/** A Jev key looks like a long opaque token; reject anything obviously not one. */
export function readCallerKey(header: string | null): string | null {
  if (!header) return null
  const key = header.trim()
  if (key.length < 20 || key.length > 400) return null
  if (!/^[A-Za-z0-9._\-]+$/.test(key)) return null
  return key
}

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 3.5)
}
