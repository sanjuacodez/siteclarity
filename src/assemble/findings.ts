import type { Decision, Finding } from '../contracts'
import type { ExtractedDoc } from '../extract/extract'
import { CHECKS, headingIsPromissory, type CheckDef } from './checks'
import { makeEvidence, verifyAll } from './verify'
import { SUGGESTERS } from './suggest'
import { findHypeTerms } from '../static/lexicons/hype'
import { compareByImpact, countOccurrences, impactTier } from './impact'
import { runStaticChecks, type StaticResult } from '../static/structure/checks'
import { STATIC_TEMPLATES } from '../static/structure/templates'
import { runLanguageSignals, LANGUAGE_TEMPLATES } from '../static/language/signals'
import { analyseBurial } from '../static/language/burial'
import { excludedSections } from '../semantic/state'

/**
 * SC-111 — turn typed decisions into human findings.
 *
 * Ordered by extraction impact: how much the issue blocks a search or AI system from
 * finding and using an answer. The rules are explicit and deterministic — the same
 * input always yields the same order.
 */

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 } as const

export interface DecisionSource {
  scope: 'page' | 'section' | 'passage'
  refId: string
  label: string
  /** The raw heading, used to decide whether heading-dependent checks apply. */
  heading?: string | null
  /** Passages that can supply evidence for this scope. */
  passageIds: string[]
  decisions: Record<string, Decision>
}

/**
 * SC-106 — deterministic findings. No model involved, so these are produced even when
 * the decision backend is unavailable. This is what makes the tool useful with no API
 * key and no cost.
 */
export function assembleStaticFindings(doc: ExtractedDoc, pageUrl: string): Finding[] {
  const out: Finding[] = []

  for (const result of runStaticChecks(doc, pageUrl)) {
    const tpl = STATIC_TEMPLATES[result.checkId]
    if (!tpl) continue

    const evidence = verifyAll(
      doc,
      result.evidenceIds
        .map((id) => makeEvidence(doc, id))
        .filter((e): e is NonNullable<typeof e> => e !== null),
    )
    // Page-level findings (a missing canonical, a noindex tag) have no passage to
    // quote and must still be reported; passage-anchored ones must have evidence.
    if (!tpl.pageLevel && evidence.length === 0) continue

    out.push({
      id: `${result.checkId}:page`,
      module: 'ai_readiness',
      checkId: result.checkId,
      observation: fill(tpl.observation, result.slots),
      evidence,
      whyItMatters: tpl.whyItMatters,
      recommendedAction: fill(tpl.recommendedAction, result.slots),
      affects: [{ pageUrl }],
      priority: tpl.priority,
      confidence: 'high', // deterministic: no model judgement involved
      highlights: [],
      copySource: 'template',
    })
  }

  // F29 — burial, measured rather than judged. The model was never confident about
  // this, so it was always discarded; lexical overlap with the heading finds it exactly.
  for (const section of doc.sections) {
    if (excludedSections(doc).has(section.id)) continue
    if (section.passageIds.length === 0) continue

    const text = section.passageIds
      .filter((id) => !doc.boilerplatePassageIds.has(id))
      .map((id) => doc.passagesById.get(id)?.text ?? '')
      .join(' ')

    const burial = analyseBurial(section.heading, text)
    if (!burial.buried) continue

    const tpl = STATIC_TEMPLATES.answer_buried_positional!
    const evidence = verifyAll(
      doc,
      section.passageIds
        .slice(0, 1)
        .map((id) => makeEvidence(doc, id))
        .filter((e): e is NonNullable<typeof e> => e !== null),
    )
    if (evidence.length === 0) continue

    const slots = { heading: section.heading ?? 'This section', words: burial.wordsBefore }
    out.push({
      id: `answer_buried_positional:${section.id}`,
      module: 'ai_readiness',
      checkId: 'answer_buried_positional',
      observation: fill(tpl.observation, slots),
      evidence,
      whyItMatters: fill(tpl.whyItMatters, slots),
      recommendedAction: fill(tpl.recommendedAction, slots),
      affects: [{ pageUrl, sectionId: section.id }],
      priority: tpl.priority,
      confidence: 'high',
      highlights: [],
      copySource: 'template',
    })
  }

  // SC-107 — language signals, over the same content the decision layer sees.
  const excluded = excludedSections(doc)
  const eligible = doc.passages.filter(
    (p) => !excluded.has(p.sectionId) && !doc.boilerplatePassageIds.has(p.id),
  )

  for (const signal of runLanguageSignals(doc, eligible)) {
    const tpl = LANGUAGE_TEMPLATES[signal.checkId]
    if (!tpl) continue

    const evidence = verifyAll(
      doc,
      signal.passageIds
        .map((id) => makeEvidence(doc, id))
        .filter((e): e is NonNullable<typeof e> => e !== null),
    )
    if (evidence.length === 0) continue

    out.push({
      id: `${signal.checkId}:page`,
      module: 'ai_readiness',
      checkId: signal.checkId,
      observation: fill(tpl.observation, signal.slots),
      evidence,
      whyItMatters: tpl.whyItMatters,
      recommendedAction: fill(tpl.recommendedAction, signal.slots),
      affects: [{ pageUrl }],
      priority: tpl.priority,
      confidence: 'high',
      highlights: [],
      copySource: 'template',
    })
  }

  return out
}

function fill(text: string, slots: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, key: string) =>
    key in slots ? String(slots[key]) : m,
  )
}

export function assembleFindings(
  doc: ExtractedDoc,
  sources: DecisionSource[],
  pageUrl: string,
): Finding[] {
  const findings: Finding[] = []

  for (const source of sources) {
    for (const check of CHECKS) {
      if (check.scope !== source.scope) continue
      if (check.requiresPromissoryHeading && !headingIsPromissory(source.heading ?? null)) continue
      const decision = source.decisions[check.questionId]
      if (!decision) continue
      if (!check.triggers(decision)) continue

      const finding = buildFinding(doc, check, source, decision, pageUrl)
      if (finding) findings.push(finding)
    }
  }

  const kept = dropRepeatedEvidence(dedupe(findings))
  const occurrences = countOccurrences(kept)
  return [...kept].sort((a, b) => compareByImpact(a, b, occurrences))
}

function buildFinding(
  doc: ExtractedDoc,
  check: CheckDef,
  source: DecisionSource,
  decision: Decision,
  pageUrl: string,
): Finding | null {
  const evidence = verifyAll(
    doc,
    source.passageIds
      .map((id) => makeEvidence(doc, id))
      .filter((e): e is NonNullable<typeof e> => e !== null)
      // A three-word fragment is not evidence of anything.
      .filter((e) => e.quote.split(/\s+/).length >= 8)
      .slice(0, 2),
  )

  // A finding with no verifiable evidence is not reported. This is the whole promise.
  if (evidence.length === 0) return null

  // A tailored suggestion where we can build one; otherwise the generic template.
  const suggester = SUGGESTERS[check.id]
  const sourceText = source.passageIds
    .map((id) => doc.passagesById.get(id)?.text ?? '')
    .join(' ')
  const tailored = suggester
    ? suggester(sourceText, source.decisions.improvement_type)
    : null

  const label = source.label

  return {
    id: `${check.id}:${source.refId}`,
    module: 'ai_readiness',
    checkId: check.id,
    observation: label
      ? check.observation.replace('{label}', label)
      : check.observation.replace('\u201c{label}\u201d', 'A section on this page'),
    evidence,
    whyItMatters: check.whyItMatters,
    recommendedAction: tailored ?? check.recommendedAction,
    highlights: suggester ? findHypeTerms(sourceText, 8).map((h) => h.term) : [],
    affects: [
      { pageUrl, ...(source.scope === 'section' ? { sectionId: source.refId } : {}) },
    ],
    priority: check.priority,
    confidence:
      decision.confidence >= 0.85 ? 'high' : decision.confidence >= 0.65 ? 'medium' : 'low',
    copySource: 'template',
  }
}

/**
 * A section that is both "absent" and "doesn't answer its heading" would otherwise
 * produce two findings saying the same thing. Keep the higher-priority one.
 */
const OVERLAP: Record<string, string[]> = {
  answer_absent: ['heading_not_answered', 'needs_context', 'answer_buried', 'answer_buried_positional'],
  // The measured signal wins over the model's judgement of the same property: it is
  // exact where the model was never confident (F29).
  answer_buried_positional: ['answer_buried', 'needs_context'],
  answer_buried: ['needs_context'],
}

function dedupe(findings: Finding[]): Finding[] {
  const bySection = new Map<string, Finding[]>()
  for (const f of findings) {
    const key = f.affects[0]?.sectionId ?? 'page'
    ;(bySection.get(key) ?? bySection.set(key, []).get(key)!).push(f)
  }

  const keep: Finding[] = []
  for (const group of bySection.values()) {
    const present = new Set(group.map((f) => f.checkId))
    const suppressed = new Set<string>()
    for (const f of group) {
      if (!present.has(f.checkId)) continue
      for (const loser of OVERLAP[f.checkId] ?? []) suppressed.add(loser)
    }
    keep.push(...group.filter((f) => !suppressed.has(f.checkId)))
  }
  return keep
}

/**
 * The same block of copy can appear in two sections (a plugin listed twice, a repeated
 * callout). Reporting it twice makes the list feel padded, so keep the first instance.
 */
function dropRepeatedEvidence(findings: Finding[]): Finding[] {
  const seen = new Set<string>()
  return findings.filter((f) => {
    const key = `${f.checkId}|${f.evidence[0]?.quote ?? f.id}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

export function summarize(findings: Finding[]) {
  return {
    count: findings.length,
    high: findings.filter((f) => f.priority === 'high').length,
    medium: findings.filter((f) => f.priority === 'medium').length,
    low: findings.filter((f) => f.priority === 'low').length,
  }
}
