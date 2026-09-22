import type { ExtractedDoc } from '../../extract/extract'

/**
 * SC-106 — the deterministic structure layer.
 *
 * No model. These run with the decision backend switched off entirely, which is the
 * whole basis of the free-tier claim: the tool must be useful with no key and no cost.
 *
 * Each check returns a typed result; templating into findings happens in the catalogue,
 * so the copy stays in one place.
 */

export interface StaticResult {
  checkId: string
  fired: boolean
  /** Slots for the finding template. */
  slots: Record<string, string | number>
  /** Passage IDs to quote as evidence, when the issue is anchored to text. */
  evidenceIds: string[]
  detail?: string
}

const ok = (checkId: string): StaticResult => ({ checkId, fired: false, slots: {}, evidenceIds: [] })

/** Structured data: present, parseable, and of a type that helps. */
export function checkStructuredData(doc: ExtractedDoc): StaticResult[] {
  const out: StaticResult[] = []

  if (doc.jsonLdRaw.length === 0) {
    out.push({ checkId: 'no_structured_data', fired: true, slots: {}, evidenceIds: [] })
    // Deliberately NOT returning here. A page written as questions and answers with no
    // markup at all should still be told to add FAQ markup specifically — that is far
    // more actionable than the generic "no structured data".
  }

  const types: string[] = []
  let malformed = 0
  for (const raw of doc.jsonLdRaw) {
    try {
      const parsed: unknown = JSON.parse(raw)
      for (const node of flatten(parsed)) {
        const t = (node as { '@type'?: unknown })['@type']
        if (typeof t === 'string') types.push(t)
        else if (Array.isArray(t)) types.push(...t.filter((x): x is string => typeof x === 'string'))
      }
    } catch {
      malformed++
    }
  }

  if (malformed > 0) {
    out.push({
      checkId: 'malformed_structured_data',
      fired: true,
      slots: { count: malformed },
      evidenceIds: [],
    })
  }

  // A page that answers questions benefits from FAQPage/HowTo/QAPage markup.
  const answerTypes = ['FAQPage', 'HowTo', 'QAPage', 'Question']
  const hasAnswerMarkup = types.some((t) => answerTypes.includes(t))
  const questionHeadings = doc.headings.filter((h) => isQuestion(h.text)).length
  if (questionHeadings >= 3 && !hasAnswerMarkup) {
    out.push({
      checkId: 'missing_faq_markup',
      fired: true,
      slots: { count: questionHeadings, types: types.slice(0, 4).join(', ') || 'none' },
      evidenceIds: [],
    })
  }

  return out
}

/** Heading hierarchy: one H1, no skipped levels. */
export function checkHeadings(doc: ExtractedDoc): StaticResult[] {
  const out: StaticResult[] = []
  const h1s = doc.headings.filter((h) => h.level === 1)

  if (h1s.length === 0) {
    out.push({ checkId: 'no_h1', fired: true, slots: {}, evidenceIds: [] })
  } else if (h1s.length > 1) {
    out.push({
      checkId: 'multiple_h1',
      fired: true,
      slots: { count: h1s.length, first: h1s[0]!.text.slice(0, 60) },
      evidenceIds: [],
    })
  }

  const skips: string[] = []
  let previous = 0
  for (const h of doc.headings) {
    if (previous > 0 && h.level > previous + 1) {
      skips.push(`h${previous} to h${h.level} at “${h.text.slice(0, 40)}”`)
    }
    previous = h.level
  }
  if (skips.length > 0) {
    out.push({
      checkId: 'skipped_heading_levels',
      fired: true,
      slots: { count: skips.length, example: skips[0]! },
      evidenceIds: [],
    })
  }

  return out
}

/** Extractable formats: lists and tables versus undifferentiated prose. */
export function checkExtractability(doc: ExtractedDoc): StaticResult[] {
  const out: StaticResult[] = []
  const total = doc.passages.length
  if (total < 6) return out

  const structured = doc.passages.filter(
    (p) => p.kind === 'listitem' || p.kind === 'cell' || p.kind === 'definition',
  ).length

  if (structured === 0) {
    out.push({
      checkId: 'no_structured_formats',
      fired: true,
      slots: { count: total },
      evidenceIds: [],
    })
  }

  // Passages long enough that an answering system cannot quote them cleanly.
  const longOnes = doc.passages.filter((p) => p.text.split(/\s+/).length > 120)
  if (longOnes.length > 0) {
    out.push({
      checkId: 'passages_too_long',
      fired: true,
      slots: {
        count: longOnes.length,
        longest: Math.max(...longOnes.map((p) => p.text.split(/\s+/).length)),
      },
      evidenceIds: longOnes.slice(0, 2).map((p) => p.id),
    })
  }

  return out
}

/** Machine access: can a crawler read and attribute this page at all. */
export function checkMachineAccess(doc: ExtractedDoc, finalUrl: string): StaticResult[] {
  const out: StaticResult[] = []
  const robots = (doc.metaRobots ?? '').toLowerCase()

  if (/\bnoindex\b/.test(robots)) {
    out.push({ checkId: 'meta_noindex', fired: true, slots: { value: doc.metaRobots ?? '' }, evidenceIds: [] })
  }
  if (/\bnoai\b|\bnoimageai\b/.test(robots)) {
    out.push({ checkId: 'meta_noai', fired: true, slots: { value: doc.metaRobots ?? '' }, evidenceIds: [] })
  }
  if (!doc.canonical) {
    out.push({ checkId: 'no_canonical', fired: true, slots: {}, evidenceIds: [] })
  } else {
    try {
      const canon = new URL(doc.canonical, finalUrl)
      const actual = new URL(finalUrl)
      if (canon.hostname !== actual.hostname) {
        out.push({
          checkId: 'canonical_offsite',
          fired: true,
          slots: { canonical: canon.toString().slice(0, 90) },
          evidenceIds: [],
        })
      }
    } catch {
      out.push({ checkId: 'canonical_invalid', fired: true, slots: { canonical: doc.canonical }, evidenceIds: [] })
    }
  }
  if (!doc.title || doc.title.trim().length < 10) {
    out.push({ checkId: 'weak_title', fired: true, slots: { title: doc.title ?? '' }, evidenceIds: [] })
  }
  if (!doc.metaDescription) {
    out.push({ checkId: 'no_meta_description', fired: true, slots: {}, evidenceIds: [] })
  }
  if (doc.jsDependency.likely) {
    out.push({ checkId: 'js_dependent', fired: true, slots: {}, evidenceIds: [] })
  }

  return out
}

export function runStaticChecks(doc: ExtractedDoc, finalUrl: string): StaticResult[] {
  return [
    ...checkStructuredData(doc),
    ...checkHeadings(doc),
    ...checkExtractability(doc),
    ...checkMachineAccess(doc, finalUrl),
  ].filter((r) => r.fired)
}

const QUESTION_WORDS = /^(how|what|why|when|where|who|which|can|do|does|is|are|should|will)\b/i
export function isQuestion(text: string): boolean {
  return text.includes('?') || QUESTION_WORDS.test(text.trim())
}

function flatten(node: unknown): Record<string, unknown>[] {
  if (Array.isArray(node)) return node.flatMap(flatten)
  if (node && typeof node === 'object') {
    const obj = node as Record<string, unknown>
    const nested = Object.values(obj).flatMap((v) =>
      typeof v === 'object' && v !== null ? flatten(v) : [],
    )
    return [obj, ...nested]
  }
  return []
}

export { ok }
