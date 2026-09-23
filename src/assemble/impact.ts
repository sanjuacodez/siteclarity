/**
 * SC-111 — extraction impact ordering.
 *
 * The report claims findings are "ordered by how much each one blocks a search or AI
 * system from using your content". Sorting by priority alone did not deliver that: a
 * `noindex` tag and a wordy paragraph were both "high" and could land either way round.
 *
 * Impact here means: **how much of the page stops being usable if this is not fixed.**
 * That is a different question from how bad it looks, and it is the one a person
 * deciding what to do first actually has.
 *
 * Tiers are deliberately coarse. A finer-grained weighting would imply a precision we
 * cannot justify, and would be harder to explain than it is worth.
 */

export type ImpactTier = 0 | 1 | 2 | 3 | 4

/** Nothing else on the page matters until these are fixed. */
const BLOCKS_WHOLE_PAGE: Record<string, true> = {
  meta_noindex: true,       // the page will not appear in search at all
  meta_noai: true,          // AI tools are told not to use it
  js_dependent: true,       // crawlers may see an almost empty page
  canonical_offsite: true,  // credit is handed to another domain
  entity_unclear: true,
  audience_drifts: true,
  audience_none_evident: true,
  audience_rarely_named: true,
  no_problem_stated: true,
  focus_not_communicated: true,     // nothing on the page can be attributed to a known subject
}

/** Costs an entire section: the answer cannot be found or does not exist. */
const BLOCKS_SECTION: Record<string, true> = {
  answer_absent: true,
  heading_not_answered: true,
  answer_buried: true,
  answer_buried_positional: true,
}

/** The answer survives but is harder to lift out cleanly. */
const DEGRADES_EXTRACTION: Record<string, true> = {
  not_self_contained: true,
  needs_context: true,
  high_anaphora: true,
  no_structured_formats: true,
  passages_too_long: true,
  malformed_structured_data: true,
}

/** The text is usable but weaker than it could be. */
const WEAKENS_CONTENT: Record<string, true> = {
  heavily_promotional: true,
  vague_claim: true,
  vague_quantifiers: true,
  long_sentences: true,
  claim_without_evidence: true,
  evidence_irrelevant: true,
  evidence_too_far: true,
  vague_cta: true,
  site_has_no_next_step: true,
  site_sells_without_explaining: true,
  journey_stage_missing: true,
  journey_concentrated: true,
  audience_not_named: true,
  no_differentiation: true,
  no_clear_action: true,
}

export function impactTier(checkId: string): ImpactTier {
  if (BLOCKS_WHOLE_PAGE[checkId]) return 0
  if (BLOCKS_SECTION[checkId]) return 1
  if (DEGRADES_EXTRACTION[checkId]) return 2
  if (WEAKENS_CONTENT[checkId]) return 3
  return 4 // metadata and housekeeping: real, but nothing is blocked
}

export const TIER_LABEL: Record<ImpactTier, string> = {
  0: 'Blocks the whole page',
  1: 'Blocks a section',
  2: 'Makes answers harder to extract',
  3: 'Weakens the content',
  4: 'Missing metadata',
}

const CONFIDENCE_RANK: Record<string, number> = { high: 0, medium: 1, low: 2 }

/**
 * Ordering, most impactful first. Deterministic: the same input always produces the
 * same order, which matters because the report is diffed across runs.
 *
 * 1. impact tier
 * 2. how many places it occurs — the same issue on six sections outranks it on one
 * 3. confidence
 * 4. check id, then finding id, purely to break ties stably
 */
export function compareByImpact(
  a: { checkId: string; id: string; confidence: string },
  b: { checkId: string; id: string; confidence: string },
  occurrences: Map<string, number>,
): number {
  const tier = impactTier(a.checkId) - impactTier(b.checkId)
  if (tier !== 0) return tier

  const count = (occurrences.get(b.checkId) ?? 1) - (occurrences.get(a.checkId) ?? 1)
  if (count !== 0) return count

  const conf = (CONFIDENCE_RANK[a.confidence] ?? 3) - (CONFIDENCE_RANK[b.confidence] ?? 3)
  if (conf !== 0) return conf

  return a.checkId.localeCompare(b.checkId) || a.id.localeCompare(b.id)
}

export function countOccurrences(findings: { checkId: string }[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const f of findings) out.set(f.checkId, (out.get(f.checkId) ?? 0) + 1)
  return out
}
