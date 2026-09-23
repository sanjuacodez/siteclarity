import { z } from 'zod'

/**
 * SC-105 — the cross-module contract.
 *
 * Every one of the ten planned modules emits findings in this shape. Changing it
 * later means revisiting all of them, so additive changes only (bump SCHEMA_VERSION);
 * renames and removals follow CONTRIBUTING.md.
 */

export const SCHEMA_VERSION = '0.1.0'

export const ModuleId = z.enum([
  'ai_readiness',            // module 1 — implemented
  'evidence_trust',
  'messaging',
  'website_understanding',
  'question_coverage',
  'buyer_journey',
  'audience_coverage',
  'product_portfolio',
  'content_overlap',
  'content_opportunity',
])
export type ModuleId = z.infer<typeof ModuleId>

/** Coverage vocabulary, frozen in planning revision 1. Maps to a Jev Choice question. */
export const CoverageLabel = z.enum([
  'answered',
  'partial',
  'conflicting',
  'not_found_in_scope',
  'cannot_assess',
])
export type CoverageLabel = z.infer<typeof CoverageLabel>

/** Applicability is deliberately separate from the label: a question can be
 *  inapplicable yet unanswered, and conflating them loses that distinction. */
export const Applicability = z.enum(['applicable', 'not_applicable', 'unknown'])

export const Priority = z.enum(['high', 'medium', 'low'])
export const Confidence = z.enum(['high', 'medium', 'low'])

/** Evidence. `quote` is populated by code from the passage store — never by a model. */
export const EvidenceRef = z.object({
  passageId: z.string().min(1),
  quote: z.string().min(1),
  sectionId: z.string().optional(),
})
export type EvidenceRef = z.infer<typeof EvidenceRef>

/**
 * A System One answer. `confidence` is the model's calibrated figure, not a
 * self-report, and is what drives `cannot_assess`.
 */
export const Decision = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('noul'),
    value: z.number().min(0).max(1),
    confidence: z.number().min(0).max(1),
  }),
  z.object({
    kind: z.literal('choice'),
    value: z.string(),
    probabilities: z.record(z.number()).optional(),
    confidence: z.number().min(0).max(1),
  }),
  z.object({
    kind: z.literal('score'),
    value: z.number(),
    legend: z.record(z.string()).optional(),
    probabilities: z.record(z.number()).optional(),
    confidence: z.number().min(0).max(1),
  }),
])
export type Decision = z.infer<typeof Decision>

/**
 * A finding. Copy fields are TEMPLATE-RENDERED from deterministic data plus typed
 * decisions — there is no generative model in this system (see CONTRIBUTING.md).
 */
export const Finding = z.object({
  id: z.string().min(1),
  module: ModuleId,
  checkId: z.string().min(1),
  observation: z.string().min(1),
  evidence: z.array(EvidenceRef),
  whyItMatters: z.string().min(1),
  recommendedAction: z.string().min(1),
  affects: z.array(
    z.object({ pageUrl: z.string().url(), sectionId: z.string().optional() }),
  ),
  priority: Priority,
  confidence: Confidence,
  /** Exact words on the page that triggered this finding, for highlighting in the
   *  evidence quote. Extracted deterministically from a committed lexicon — the point
   *  is to SHOW which words need rework, not to rewrite them. */
  highlights: z.array(z.string()).default([]),
  /** Provenance of the copy. Template-only today; the field exists so any future
   *  departure from that is explicit rather than silent. */
  copySource: z.literal('template').default('template'),
})
export type Finding = z.infer<typeof Finding>

/** What was and was not examined. Never optional, never boilerplate. */
export const Limits = z.object({
  scope: z.enum(['single_page', 'partial_site', 'site']),
  statements: z.array(z.string().min(1)).min(1),
  decisionsRan: z.boolean(),
  sectionsAnalyzed: z.number().int().nonnegative(),
  sectionsTotal: z.number().int().nonnegative(),
  stateSplit: z.boolean(),
  language: z.string().nullable(),
  languageSupported: z.boolean(),
  jsDependent: z.boolean(),
})
export type Limits = z.infer<typeof Limits>

export const SectionReport = z.object({
  sectionId: z.string(),
  heading: z.string().nullable(),
  level: z.number().int().min(0).max(6),
  passageCount: z.number().int().nonnegative(),
  decisions: z.record(Decision).default({}),
})

export const ProviderInfo = z.object({
  backend: z.enum(['workersai', 'systemone', 'laya', 'replay', 'none']),
  model: z.string().nullable(),
  calls: z.number().int().nonnegative(),
  inputTokens: z.number().int().nonnegative(),
  outputTokens: z.number().int().nonnegative(),
  degraded: z.boolean(),
  degradedReason: z.string().nullable(),
})

/**
 * Module 4 — Website Understanding.
 *
 * A profile, not findings, so it does not use the `Finding` contract: forcing a
 * description into observation/whyItMatters/recommendedAction would produce advice
 * nobody asked for.
 *
 * Each entry is either a verbatim quote from the page with the passage it came from, or
 * `null` with a reason. There is no generated text here — the model selects which of the
 * page's own sentences states a thing; it never writes one.
 */
export const ProfileDimension = z.enum([
  'business_type',
  'what_it_does',
  'who_its_for',
  'problem_solved',
  'differentiator',
])
export type ProfileDimension = z.infer<typeof ProfileDimension>

export const ProfileEntry = z.object({
  dimension: ProfileDimension,
  /** A closed-taxonomy answer, for dimensions that have one. */
  value: z.string().nullable(),
  /** The page's own words. Verbatim, looked up by id — never model-authored. */
  quote: z.string().nullable(),
  passageId: z.string().nullable(),
  sectionId: z.string().nullable(),
  /** Present when the page does not state this. Not a failure — it is the answer. */
  absentReason: z.string().nullable(),
  confidence: Confidence.nullable(),
})
export type ProfileEntry = z.infer<typeof ProfileEntry>

/**
 * A page reduced to typed values, for site-level analysis.
 *
 * Six of these seven fields are already computed by modules 1 to 4 and thrown away; the
 * inventory is mostly a matter of returning them. No prose, because nothing may be
 * generated, and no passages, because twenty-five of these must fit a decision model's
 * context — 512 tokens on a local Laya checkpoint.
 *
 *
 */
export const PageSummary = z.object({
  url: z.string(),
  title: z.string().nullable(),
  /** From purpose_clarity: explain | sell | compare | support | navigate | unclear. */
  purpose: z.string().nullable(),
  businessType: z.string().nullable(),
  /** Heading terms, for overlap detection without embeddings. */
  topicTerms: z.array(z.string()),
  /** Whether the page names who it is for. */
  audienceNamed: z.boolean().nullable(),
  /** Whether the page offers a next step. */
  hasAction: z.boolean(),
  findingCounts: z.object({
    count: z.number().int().nonnegative(),
    high: z.number().int().nonnegative(),
  }),
})
export type PageSummary = z.infer<typeof PageSummary>

export const AnalysisResult = z.object({
  schemaVersion: z.literal(SCHEMA_VERSION),
  input: z.object({
    requestedUrl: z.string(),
    finalUrl: z.string(),
    fetchedAt: z.string(),
    title: z.string().nullable(),
  }),
  limits: Limits,
  sections: z.array(SectionReport),
  findings: z.array(Finding),
  /** Module 4's descriptive output. Empty when the decision model did not run. */
  profile: z.array(ProfileEntry).default([]),
  /** This page reduced to typed values, for the site-level pass. */
  summary_for_site: PageSummary.nullable().default(null),
  provider: ProviderInfo,
  timings: z.record(z.number()),
})
export type AnalysisResult = z.infer<typeof AnalysisResult>

/**
 * Invariant 2, enforced in code: no overall score anywhere in the output.
 *
 * A per-question Jev `Score` is a rubric answer about one narrow statement; it is
 * NOT a page grade. This guard exists so a future agent cannot quietly add one.
 */
const BANNED_SCORE_KEYS = [
  'score', 'overallScore', 'rating', 'grade', 'total', 'points', 'percentage', 'rank',
]

export function assertNoOverallScore(result: unknown, path = 'result'): void {
  if (result === null || typeof result !== 'object') return
  if (Array.isArray(result)) {
    result.forEach((v, i) => assertNoOverallScore(v, `${path}[${i}]`))
    return
  }
  for (const [key, value] of Object.entries(result as Record<string, unknown>)) {
    // `decisions.<id>.score` is a permitted per-question rubric answer.
    const isPerQuestionScore = key === 'score' && path.includes('decisions')
    if (BANNED_SCORE_KEYS.includes(key) && !isPerQuestionScore) {
      throw new Error(
        `Invariant 2 violated: overall score field "${key}" at ${path}. ` +
          `SiteClarity reports prioritised findings, never a grade.`,
      )
    }
    assertNoOverallScore(value, `${path}.${key}`)
  }
}
