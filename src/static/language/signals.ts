import type { ExtractedDoc, Passage } from '../../extract/extract'

/**
 * SC-107 — deterministic language signals. No model.
 *
 * Thresholds are named constants with recorded rationale rather than magic numbers,
 * because every one of them is a judgement call that a future contributor will want to
 * question. All lexicons and patterns here are English-only; see `languageGate`.
 */

/** Below this, a passage is too short for density measures to mean anything. */
const MIN_WORDS_FOR_DENSITY = 25
/** Sentence-initial pronouns above this share suggest text that cannot stand alone. */
const ANAPHORA_SHARE_THRESHOLD = 0.34
/** A passage making claims with no concrete detail at all. */
const MIN_SPECIFIC_TOKENS = 1
/** Long sentences are hard to quote; this is the mean, not a maximum. */
const LONG_SENTENCE_MEAN = 30

/** Numbers, dates, units, currencies, percentages — anything checkable. */
const SPECIFIC_TOKEN =
  /(\b\d[\d,.]*\s*(%|percent|x|ms|s|kb|mb|gb|tb|hz|px|km|kg|mi|lbs?|hours?|mins?|minutes?|days?|weeks?|months?|years?)\b)|([$£€₹]\s?\d)|(\b\d{4}\b)|(\b\d[\d,.]*\b)/gi

/** Openers that point outside the passage for their meaning. */
const ANAPHORIC_OPENER =
  /^\s*(it|this|that|these|those|they|them|their|such|the former|the latter|here|there)\b/i

/** Vague quantifiers that sound specific but are not. */
const FALSE_PRECISION =
  /\b(many|several|various|numerous|a lot|lots|some|most|few|countless|plenty|multiple|significant|substantial)\b/gi

export interface LanguageSignal {
  checkId: string
  passageIds: string[]
  slots: Record<string, string | number>
}

const words = (t: string) => t.split(/\s+/).filter(Boolean)
const sentences = (t: string) => t.split(/(?<=[.!?])\s+/).filter((s) => s.trim().length > 0)

/**
 * English-only gate. Other languages return no signals rather than a bad guess —
 * applying an English lexicon to German prose produces confident nonsense.
 */
export function languageSupported(doc: ExtractedDoc): boolean {
  const lang = (doc.lang ?? '').toLowerCase()
  if (!lang) return true // unlabelled: assume English rather than skip everything
  return lang === 'en' || lang.startsWith('en-')
}

export function runLanguageSignals(doc: ExtractedDoc, eligible: Passage[]): LanguageSignal[] {
  if (!languageSupported(doc)) return []

  const out: LanguageSignal[] = []
  const substantial = eligible.filter((p) => words(p.text).length >= MIN_WORDS_FOR_DENSITY)

  // 1. Anaphora load — passages that open by pointing elsewhere.
  const anaphoric = substantial.filter((p) => {
    const ss = sentences(p.text)
    if (ss.length < 2) return false
    const hits = ss.filter((s) => ANAPHORIC_OPENER.test(s)).length
    return hits / ss.length >= ANAPHORA_SHARE_THRESHOLD
  })
  if (anaphoric.length > 0) {
    out.push({
      checkId: 'high_anaphora',
      passageIds: anaphoric.slice(0, 3).map((p) => p.id),
      slots: { count: anaphoric.length },
    })
  }

  // 2. No concrete detail anywhere in a substantial passage.
  const unspecific = substantial.filter((p) => {
    const specific = (p.text.match(SPECIFIC_TOKEN) ?? []).length
    const vague = (p.text.match(FALSE_PRECISION) ?? []).length
    return specific < MIN_SPECIFIC_TOKENS && vague > 0
  })
  if (unspecific.length > 0) {
    const sample = unspecific[0]!
    const vagueWords = [
      ...new Set((sample.text.match(FALSE_PRECISION) ?? []).map((w) => w.toLowerCase())),
    ].slice(0, 3)
    out.push({
      checkId: 'vague_quantifiers',
      passageIds: unspecific.slice(0, 3).map((p) => p.id),
      slots: { count: unspecific.length, words: vagueWords.map((w) => `“${w}”`).join(', ') },
    })
  }

  // 3. Sentences too long to quote comfortably.
  //
  // Paragraphs only: a list item rarely ends in a full stop, so the sentence splitter
  // reads the whole bullet as one enormous sentence and reports a false positive.
  const dense = substantial.filter((p) => p.kind === 'paragraph').filter((p) => {
    const ss = sentences(p.text)
    if (ss.length === 0) return false
    return words(p.text).length / ss.length >= LONG_SENTENCE_MEAN
  })
  if (dense.length > 0) {
    const worst = dense.reduce((a, b) =>
      words(a.text).length / sentences(a.text).length >
      words(b.text).length / sentences(b.text).length
        ? a
        : b,
    )
    out.push({
      checkId: 'long_sentences',
      passageIds: dense.slice(0, 3).map((p) => p.id),
      slots: {
        count: dense.length,
        mean: Math.round(words(worst.text).length / sentences(worst.text).length),
      },
    })
  }

  return out
}

export const LANGUAGE_TEMPLATES: Record<
  string,
  { priority: 'high' | 'medium' | 'low'; observation: string; whyItMatters: string; recommendedAction: string }
> = {
  high_anaphora: {
    priority: 'medium',
    observation: '{count} paragraph(s) start with “it”, “this” or “they” instead of naming the subject.',
    whyItMatters:
      'These words only make sense if you read what came before. AI tools quote one paragraph at a time, so the reader sees “it” with no idea what “it” is.',
    recommendedAction:
      'Start each paragraph with the actual name, so it still makes sense on its own.',
  },
  vague_quantifiers: {
    priority: 'low',
    observation: 'Some paragraphs use vague words — {words} — with no actual numbers.',
    whyItMatters:
      'Words like “many” and “several” sound specific but say nothing. A reader cannot judge them and an AI tool cannot quote them.',
    recommendedAction:
      'Put the real number in, or cut the word. “Several integrations” becomes “14 integrations”.',
  },
  long_sentences: {
    priority: 'low',
    observation: '{count} paragraph(s) have sentences averaging {mean} words.',
    whyItMatters:
      'Long sentences get cut off when quoted, so tools tend to pick shorter ones — often from someone else’s site.',
    recommendedAction:
      'Break the longest sentences up so each one makes a single point.',
  },
}
