import type { ExtractedDoc, Passage, Section } from '../extract/extract'
import { estimateTokens } from '../lib/config'

/**
 * SC-109 — scope-partitioned state.
 *
 * Jev 1.13 has a 32k context. The instinct is to chunk a long page across calls;
 * that is fragile at boundaries and does not scale to the multi-page modules at all.
 *
 * Instead: almost every question here is section- or passage-scoped, so each gets the
 * smallest state that can answer it. Every state fits comfortably, so truncation
 * never happens — and it is MORE correct, because "is this section understandable in
 * isolation?" is a question about the section alone. Padding it with page context
 * actively corrupts the answer.
 */

export interface ScopedState<T = unknown> {
  scope: 'page' | 'section' | 'passage'
  refId: string
  state: Record<string, unknown>
  estimatedTokens: number
  meta: T
}

/** Page scope: enough to judge identity and purpose, never the whole body. */
export function buildPageState(doc: ExtractedDoc, url: string): ScopedState {
  const firstSection = doc.sections.find((s) => s.passageIds.length > 0)
  const opening = firstSection
    ? firstSection.passageIds
        .slice(0, 3)
        .map((id) => doc.passagesById.get(id)?.text ?? '')
        .join(' ')
        .slice(0, 1200)
    : ''

  const state = {
    url,
    title: doc.title,
    meta_description: doc.metaDescription,
    headings: doc.headings.slice(0, 40).map((h) => `${'#'.repeat(h.level)} ${h.text}`),
    opening_text: opening,
  }

  return {
    scope: 'page',
    refId: 'page',
    state,
    estimatedTokens: estimateTokens(JSON.stringify(state)),
    meta: {},
  }
}

/**
 * Section scope: the section and nothing from any other section. The page anchor is
 * one line — enough to know what document this is, not enough to leak context that
 * would invalidate the self-containment question.
 */
export function buildSectionStates(
  doc: ExtractedDoc,
  maxTokensPerState: number,
  opts: { minWords?: number; maxSections?: number } = {},
): ScopedState<{ section: Section }>[] {
  const anchor = doc.title ?? 'Untitled page'
  const out: ScopedState<{ section: Section }>[] = []
  const minWords = opts.minWords ?? 12
  const maxSections = opts.maxSections ?? 40

  // Marketing pages commonly carry 100+ headings over near-empty sections (nav blocks,
  // card grids, footers). Asking about those wastes calls and produces noise, so keep
  // only sections with enough text to judge, largest first, and disclose the cap.
  const excluded = excludedSections(doc)
  const candidates = doc.sections
    .filter((s) => s.passageIds.length > 0 && !excluded.has(s.id))
    .map((section) => ({
      section,
      words: section.passageIds.reduce(
        (n, id) => n + (doc.passagesById.get(id)?.text.split(/\s+/).length ?? 0),
        0,
      ),
    }))
    .filter((c) => c.words >= minWords)

  const selected = [...candidates]
    .sort((a, b) => b.words - a.words)
    .slice(0, maxSections)
    .map((c) => c.section.id)
  const keep = new Set(selected)

  for (const section of doc.sections) {
    if (!keep.has(section.id)) continue

    const texts = section.passageIds
      .map((id) => doc.passagesById.get(id)?.text ?? '')
      .filter(Boolean)

    // A single section over budget is rare; split it deterministically by passage
    // rather than truncating, and let the caller disclose the split.
    const chunks = splitToBudget(texts, maxTokensPerState)

    chunks.forEach((chunk, i) => {
      const state = {
        page_title: anchor,
        heading: section.heading,
        heading_level: section.level,
        text: chunk.join('\n\n'),
        ...(chunks.length > 1 ? { part: `${i + 1} of ${chunks.length}` } : {}),
      }
      out.push({
        scope: 'section',
        refId: chunks.length > 1 ? `${section.id}#${i}` : section.id,
        state,
        estimatedTokens: estimateTokens(JSON.stringify(state)),
        meta: { section },
      })
    })
  }

  return out
}

/** Passage scope: one candidate claim plus its heading. ~100 tokens. */
export function buildPassageStates(
  doc: ExtractedDoc,
  candidates: Passage[],
): ScopedState<{ passage: Passage }>[] {
  return candidates.map((passage) => {
    const section = doc.sections.find((s) => s.id === passage.sectionId)
    const state = {
      heading: section?.heading ?? null,
      text: passage.text,
    }
    return {
      scope: 'passage',
      refId: passage.id,
      state,
      estimatedTokens: estimateTokens(JSON.stringify(state)),
      meta: { passage },
    }
  })
}

function splitToBudget(texts: string[], maxTokens: number): string[][] {
  const chunks: string[][] = []
  let current: string[] = []
  let tokens = 0

  for (const text of texts) {
    const t = estimateTokens(text)
    if (current.length > 0 && tokens + t > maxTokens) {
      chunks.push(current)
      current = []
      tokens = 0
    }
    current.push(text)
    tokens += t
  }
  if (current.length > 0) chunks.push(current)
  return chunks.length > 0 ? chunks : [[]]
}

/**
 * Passages worth asking claim questions about. Deterministic pre-filter: sending every
 * passage would be wasteful, and the static signals already tell us which ones look
 * like claims.
 */
/**
 * Testimonial and review blocks: runs of sections headed by a person's name or a
 * username rather than a topic.
 *
 * These must be excluded entirely, not merely down-ranked. They are user-generated
 * content the site owner cannot rewrite, so every finding about them is advice nobody
 * can act on — and unactionable findings are precisely what this product exists to
 * avoid producing.
 */
const NAME_LIKE = /^[\p{L}][\p{L}\p{N}'’._\-]*(\s+[\p{L}][\p{L}\p{N}'’._\-]*){0,3}$/u
const TOPIC_WORDS =
  /\b(how|what|why|when|where|who|which|guide|pricing|price|feature|support|plugin|theme|service|about|contact|faq|docs?|start|setup|install|use|work|best|top|free|vs|compare|affordable|quality|team|product|solution)\b/i

/** First person SINGULAR — the reviewer's voice. */
const REVIEWER_VOICE = /\b(i|i'?ve|i'?m|i'?d|i'?ll|me|my|mine|myself)\b/gi
/** First person PLURAL — the company's voice. */
const COMPANY_VOICE = /\b(we|we'?ve|we'?re|our|ours|us)\b/gi

export function isNameLikeHeading(heading: string | null): boolean {
  if (!heading) return true // an unheaded block can still be a review card
  const t = heading.replace(/[\uFFFC\u200B]/g, '').trim()
  if (!t || t.includes('?')) return false
  if (TOPIC_WORDS.test(t)) return false
  return NAME_LIKE.test(t)
}

/**
 * Testimonial and review detection (findings F2, F8).
 *
 * Heading shape alone is not enough — it both misses usernames like
 * `jodiebradshaw1974` and would wrongly flag real headings like "Most Affordable
 * Prices". The reliable signal is VOICE: a review speaks as "I", marketing copy
 * speaks as "we".
 *
 * These sections are excluded entirely rather than down-ranked. They are content the
 * site owner cannot rewrite, so any finding about them is advice nobody can act on —
 * and unactionable findings are exactly what this product exists not to produce.
 */
/** A section short enough, and headed plainly enough, to be a review card. */
function looksLikeReviewCard(doc: ExtractedDoc, section: Section): boolean {
  const words = sectionWords(doc, section)
  return words > 0 && words <= 150 && isNameLikeHeading(section.heading)
}

function sectionWords(doc: ExtractedDoc, section: Section): number {
  return section.passageIds
    .map((id) => doc.passagesById.get(id)?.text ?? '')
    .join(' ')
    .split(/\s+/)
    .filter(Boolean).length
}

/**
 * High-confidence review: the reviewer's own voice ("I", "my") is present and not
 * outweighed by the company's ("we", "our"). Used as a SEED, not as the whole test —
 * plenty of genuine reviews are voiceless fragments ("Fair price, fantastic support").
 */
export function isReviewSection(doc: ExtractedDoc, section: Section): boolean {
  if (!looksLikeReviewCard(doc, section)) return false
  const text = section.passageIds
    .map((id) => doc.passagesById.get(id)?.text ?? '')
    .join(' ')
  const mine = (text.match(REVIEWER_VOICE) ?? []).length
  const ours = (text.match(COMPANY_VOICE) ?? []).length
  return mine >= 1 && mine >= ours
}

/**
 * Review blocks are contiguous: a testimonial carousel emits a run of short,
 * name-headed sections. So detection is two-pass —
 *
 *   1. seed on the reviews that carry an unmistakable reviewer voice;
 *   2. expand outward from each seed across adjacent review-shaped sections.
 *
 * Voice alone missed roughly a third of them (finding F8); adjacency alone would
 * catch legitimate short sections. Together they are precise: a marketing heading
 * like "Most Affordable Prices" contains topic words, so it is never review-shaped
 * and never joins a run.
 */
/**
 * Link cards and related-post lists (finding F12).
 *
 * A "related posts" block emits one section per card: the heading is another article's
 * title and the body is a byline or teaser repeated across every card. Analysed as
 * content, each one looks like a heading that promises information and delivers none —
 * which is how a five-page scan produced sixteen false `answer_absent` findings, all
 * quoting the same author bio.
 *
 * The reliable signal is that the body is boilerplate: identical text under three or
 * more different headings (computed in the extractor), or nothing left once boilerplate
 * is removed.
 */
export function detectLinkCardSections(doc: ExtractedDoc): Set<string> {
  const skip = new Set<string>()
  for (const section of doc.sections) {
    if (section.passageIds.length === 0) continue
    const substantive = section.passageIds.filter(
      (id) => !doc.boilerplatePassageIds.has(id),
    )
    // Every passage in the section is repeated elsewhere: a card, not a section.
    if (substantive.length === 0) {
      skip.add(section.id)
      continue
    }
    // Mostly boilerplate plus a scrap is still a card.
    const words = substantive.reduce(
      (n, id) => n + (doc.passagesById.get(id)?.text.split(/\s+/).length ?? 0),
      0,
    )
    if (words < 12 && substantive.length < section.passageIds.length) skip.add(section.id)
  }
  return skip
}

/** Sections excluded from analysis for any reason: reviews, link cards, boilerplate. */
export function excludedSections(doc: ExtractedDoc): Set<string> {
  const out = detectTestimonialSections(doc)
  for (const id of detectLinkCardSections(doc)) out.add(id)
  return out
}

export function detectTestimonialSections(doc: ExtractedDoc): Set<string> {
  const sections = doc.sections
  const cardish = sections.map((s) => looksLikeReviewCard(doc, s))
  const seeds = sections.map((s, i) => cardish[i] && isReviewSection(doc, s))
  const skip = new Set<string>()

  for (let i = 0; i < sections.length; i++) {
    if (!seeds[i]) continue
    for (let j = i; j >= 0 && cardish[j]; j--) skip.add(sections[j]!.id)
    for (let j = i; j < sections.length && cardish[j]; j++) skip.add(sections[j]!.id)
  }

  // A long unbroken run of review-shaped sections is a testimonial block even when
  // none of them happens to say "I".
  let start = 0
  for (let i = 0; i <= sections.length; i++) {
    if (i < sections.length && cardish[i]) continue
    if (i - start >= 3) for (let j = start; j < i; j++) skip.add(sections[j]!.id)
    start = i + 1
  }

  return skip
}

export function selectClaimCandidates(doc: ExtractedDoc, limit = 25): Passage[] {
  const CLAIM_HINTS =
    /\b(fastest|best|leading|most|only|guarantee|proven|trusted|secure|reliable|award|\d+\s*%|\d+x|\d{3,})\b/i

  // Passage-level checks must honour the same exclusion as section-level ones.
  // Without this, claim analysis walks straight back into the testimonial block and
  // reports a customer's "definitely the best" as a vague marketing claim — advice
  // the site owner cannot act on, and precisely the noise this product must not emit.
  const excluded = excludedSections(doc)

  return doc.passages
    .filter(
      (p) =>
        !excluded.has(p.sectionId) &&
        !doc.boilerplatePassageIds.has(p.id) &&
        p.text.length > 40 &&
        CLAIM_HINTS.test(p.text),
    )
    .slice(0, limit)
}
