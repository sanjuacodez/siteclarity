import type { EvidenceRef } from '../contracts'
import type { ExtractedDoc } from '../extract/extract'
import { logger } from '../lib/logger'

/**
 * SC-110 — the quote verification gate.
 *
 * Invariant 1 made executable: every quote must be a verbatim substring of a stored
 * passage. The decision model returns typed values only and cannot emit prose, so this
 * is largely structural — but it runs anyway, as defence in depth, at zero tolerance.
 *
 * Normalisation is deliberately narrow: whitespace collapsing and NFC only. Loose
 * normalisation is exactly how fabricated evidence slips through a check like this.
 */
const normalize = (s: string) => s.normalize('NFC').replace(/\s+/g, ' ').trim()

export function makeEvidence(
  doc: ExtractedDoc,
  passageId: string,
  maxChars = 240,
): EvidenceRef | null {
  const passage = doc.passagesById.get(passageId)
  if (!passage) {
    logger.warn('evidence dropped: unknown passage id', { passageId })
    return null
  }

  // A prefix of the stored text is by construction a verbatim substring of it.
  const full = passage.text
  const quote = full.length <= maxChars ? full : `${full.slice(0, maxChars).trimEnd()}…`

  return { passageId, quote, sectionId: passage.sectionId }
}

/** Zero tolerance: a quote that is not a verbatim substring is dropped, never repaired. */
export function verifyEvidence(doc: ExtractedDoc, ref: EvidenceRef): boolean {
  const passage = doc.passagesById.get(ref.passageId)
  if (!passage) return false
  const quote = normalize(ref.quote.replace(/…$/, ''))
  return normalize(passage.text).includes(quote)
}

export function verifyAll(doc: ExtractedDoc, refs: EvidenceRef[]): EvidenceRef[] {
  return refs.filter((r) => {
    const ok = verifyEvidence(doc, r)
    if (!ok) logger.error('QUOTE VERIFICATION FAILED — finding dropped', { passageId: r.passageId })
    return ok
  })
}
