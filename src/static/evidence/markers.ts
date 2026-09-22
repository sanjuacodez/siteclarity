/**
 * Module 2 — Evidence & Trust: deterministic half.
 *
 * A marketing claim is only as good as what sits near it. This finds the claims, finds
 * the evidence, and measures the distance between them — all without a model, because
 * both are textual patterns rather than judgements.
 *
 * The model is used for exactly one thing (see `questions.ts`): deciding whether
 * evidence that IS nearby actually supports the claim it sits beside. Proximity is
 * measurable; relevance is not.
 */
import type { ExtractedDoc, Passage } from '../../extract/extract'
import { findHypeTerms } from '../lexicons/hype'

/** The claim families named in the product brief. */
export type ClaimKind =
  | 'performance'
  | 'outcome'
  | 'leadership'
  | 'ease'
  | 'security'
  | 'reliability'

const CLAIM_PATTERNS: { kind: ClaimKind; re: RegExp; what: string }[] = [
  {
    kind: 'performance',
    re: /\b(faster|fastest|speed|latency|performance|instant|real[- ]?time|lightweight|optimi[sz]ed|throughput)\b/i,
    what: 'speed or efficiency',
  },
  {
    kind: 'outcome',
    re: /\b(increase|boost|improve|grow|reduce|cut|save|drive|convert|conversion|roi|revenue|results?)\b/i,
    what: 'a result for the customer',
  },
  {
    kind: 'leadership',
    re: /\b(leading|market[- ]leader|number one|#1|most popular|trusted by|industry standard|award[- ]winning)\b/i,
    what: 'market position',
  },
  {
    kind: 'ease',
    re: /\b(easy|easily|simple|simply|effortless|seamless|no code|one[- ]click|in (?:seconds|minutes)|set ?up in)\b/i,
    what: 'how little effort it takes',
  },
  {
    kind: 'security',
    re: /\b(secure|security|encrypted|encryption|gdpr|compliant|compliance|soc ?2|iso ?27001|privacy)\b/i,
    what: 'security or compliance',
  },
  {
    kind: 'reliability',
    re: /\b(reliable|reliability|uptime|stable|robust|guaranteed|always (?:on|available)|never fails?)\b/i,
    what: 'reliability',
  },
]

/** Evidence that can be recognised from the text alone. */
export type EvidenceKind = 'figure' | 'source' | 'documentation' | 'named' | 'timeframe'

const EVIDENCE_PATTERNS: { kind: EvidenceKind; re: RegExp }[] = [
  // A number with a unit, percentage or currency — the strongest textual evidence.
  { kind: 'figure', re: /(\b\d[\d,.]*\s*(%|percent|x\b|ms\b|s\b|gb\b|mb\b|k\b|m\b|hours?|minutes?|days?|weeks?|months?|years?|users?|customers?|installs?|sites?|stores?|teams?))|([$£€₹]\s?\d)/i },
  { kind: 'source', re: /\b(according to|source:|study|research|survey|benchmark|report(?:ed)? by|cited|measured|tested)\b/i },
  { kind: 'documentation', re: /\b(documentation|docs|changelog|api reference|case study|whitepaper|guide)\b/i },
  { kind: 'named', re: /\b(certified|audited|verified|iso ?27001|soc ?2|pci[- ]dss|gdpr)\b/i },
  { kind: 'timeframe', re: /\b(since \d{4}|in \d{4}|as of \w+ \d{4}|q[1-4] \d{4})\b/i },
]

export interface ClaimFinding {
  passage: Passage
  kind: ClaimKind
  /** What the claim is about, for the finding copy. */
  what: string
  /** Hype words in the claim, for highlighting. */
  terms: string[]
  /** Evidence found in the claim itself or an adjacent passage. */
  evidence: EvidenceKind[]
  /** Passage that carries the supporting evidence, when it is not the claim itself. */
  supportId: string | null
  /** How many passages away the support sits. 0 means same passage. */
  distance: number
}

/** How far from a claim we will still count evidence as "nearby". */
const NEARBY_PASSAGES = 2
/** Below this, a passage is too short to be making a claim worth auditing. */
const MIN_CLAIM_WORDS = 8

export function detectEvidence(text: string): EvidenceKind[] {
  return EVIDENCE_PATTERNS.filter((p) => p.re.test(text)).map((p) => p.kind)
}

export function classifyClaim(text: string): { kind: ClaimKind; what: string } | null {
  for (const p of CLAIM_PATTERNS) if (p.re.test(text)) return { kind: p.kind, what: p.what }
  return null
}

/**
 * Find claims and the evidence nearest to them.
 *
 * Only passages that carry a hype term AND match a claim family are considered. Either
 * signal alone is too loose: "faster" appears in neutral prose, and "world-class"
 * appears without claiming anything checkable.
 */
export function findClaims(doc: ExtractedDoc, excluded: Set<string>): ClaimFinding[] {
  const out: ClaimFinding[] = []
  const bySection = new Map<string, Passage[]>()
  for (const p of doc.passages) {
    if (excluded.has(p.sectionId) || doc.boilerplatePassageIds.has(p.id)) continue
    const list = bySection.get(p.sectionId) ?? []
    list.push(p)
    bySection.set(p.sectionId, list)
  }

  for (const passages of bySection.values()) {
    passages.forEach((passage, i) => {
      if (passage.text.split(/\s+/).length < MIN_CLAIM_WORDS) return

      const terms = findHypeTerms(passage.text, 4).map((t) => t.term)
      const claim = classifyClaim(passage.text)
      // Both signals required: hype alone is not a claim, a claim word alone is not a boast.
      if (terms.length === 0 || !claim) return

      const own = detectEvidence(passage.text)
      if (own.length > 0) {
        out.push({ passage, ...claim, terms, evidence: own, supportId: null, distance: 0 })
        return
      }

      // Look at the neighbours — evidence often sits in the sentence after a claim.
      for (let d = 1; d <= NEARBY_PASSAGES; d++) {
        for (const j of [i + d, i - d]) {
          const neighbour = passages[j]
          if (!neighbour) continue
          const near = detectEvidence(neighbour.text)
          if (near.length > 0) {
            out.push({ passage, ...claim, terms, evidence: near, supportId: neighbour.id, distance: d })
            return
          }
        }
      }

      out.push({ passage, ...claim, terms, evidence: [], supportId: null, distance: -1 })
    })
  }

  return out
}

export const EVIDENCE_LABEL: Record<EvidenceKind, string> = {
  figure: 'a number',
  source: 'a source or measurement',
  documentation: 'a link to documentation or a case study',
  named: 'a named certification',
  timeframe: 'a date',
}
