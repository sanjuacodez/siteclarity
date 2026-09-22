/**
 * Deterministic burial detection (finding F29).
 *
 * Live calibration showed the model is weak here: given a section whose answer follows
 * three sentences of preamble, `extraction_readiness` returned `"ready"` at 0.39 and
 * `"buried"` at 0.34 across runs — never confident, so the pipeline discarded it and
 * the finding was simply missed.
 *
 * Burial is a POSITIONAL property, and position is what deterministic code is good at.
 * The signal used here is lexical: a heading names what the section is about, so the
 * sentence that actually addresses it reuses the heading's own words. Find the first
 * sentence that does, and everything before it is preamble.
 *
 * This needs no model, costs nothing, and runs with the decision layer switched off.
 */

/** Words that carry no topic, so overlap with them means nothing. */
const STOPWORDS = new Set([
  'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'do', 'does',
  'did', 'can', 'could', 'will', 'would', 'should', 'may', 'might', 'must', 'have',
  'has', 'had', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'from', 'by', 'as',
  'and', 'or', 'but', 'if', 'it', 'its', 'this', 'that', 'these', 'those', 'you',
  'your', 'we', 'our', 'they', 'their', 'what', 'which', 'who', 'when', 'where',
  'why', 'how', 'there', 'here', 'about', 'into', 'than', 'then', 'so', 'also',
])

/** Preamble words before the answer, past which a reader has given up. */
const BURIED_WORD_DISTANCE = 25
/** How much of the heading a sentence must echo to count as addressing it. */
const OVERLAP_RATIO = 0.4

export interface BurialResult {
  /** Index of the first sentence that addresses the heading; -1 if none does. */
  answerSentence: number
  /** Words preceding that sentence. */
  wordsBefore: number
  buried: boolean
  /** The preamble, for quoting back to the writer. */
  preamble: string
}

const words = (t: string) =>
  t.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) ?? []

export function topicTerms(heading: string): string[] {
  const stemmed = words(heading)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    // Crude stemming so "supported" matches "supports".
    .map((w) => w.replace(/(ing|ed|es|s)$/, ''))
    .filter((w) => w.length > 2)
  return [...new Set(stemmed)]
}

export function splitSentences(text: string): string[] {
  return text.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
}

export function analyseBurial(heading: string | null, text: string): BurialResult {
  const none: BurialResult = { answerSentence: -1, wordsBefore: 0, buried: false, preamble: '' }
  if (!heading) return none

  const terms = topicTerms(heading)
  // Too few topic words to measure overlap against — stay silent rather than guess.
  if (terms.length < 2) return none

  const sentences = splitSentences(text)
  if (sentences.length < 3) return none // a short section cannot bury anything

  let running = 0
  for (let i = 0; i < sentences.length; i++) {
    const sentenceWords = new Set(
      words(sentences[i]!).map((w) => w.replace(/(ing|ed|es|s)$/, '')),
    )
    const hits = terms.filter((t) => sentenceWords.has(t)).length
    if (hits / terms.length >= OVERLAP_RATIO) {
      return {
        answerSentence: i,
        wordsBefore: running,
        buried: i > 0 && running >= BURIED_WORD_DISTANCE,
        preamble: sentences.slice(0, i).join(' '),
      }
    }
    running += words(sentences[i]!).length
  }

  // Nothing addressed the heading. That is `answer_absent`'s territory, not burial,
  // and the model judges it well, so say nothing here.
  return none
}
