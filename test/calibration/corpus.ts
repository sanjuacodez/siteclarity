/**
 * SC-113 — the calibration corpus.
 *
 * Ground truth for the DETERMINISTIC layer. Every expectation here was checked by hand
 * against the fixture, and each carries the reason it is expected — a labelled corpus
 * with no rationale is unmaintainable the moment a check changes.
 *
 * NOTE: two of the original hand-labels here were WRONG and the code was right — acowebs
 * has no <h1> at all, and the article does contain lists and tables. Both were corrected
 * only after checking the fixture directly. Label from the source, never from assumption.
 *
 * Deliberately no expectations for model-driven checks: those vary per model and per
 * version, and pinning them here would encode one model's behaviour as correctness.
 * Model calibration belongs in a separate, live, budget-capped run.
 */
export interface Expectation {
  /** Must appear in the static findings. */
  expect: string[]
  /** Must NOT appear — the false positives that have actually bitten us. */
  reject: string[]
  why: Record<string, string>
}

export const CORPUS: Record<string, Expectation> = {
  'acowebs-home': {
    expect: ['no_h1', 'missing_faq_markup', 'skipped_heading_levels'],
    reject: ['js_dependent', 'meta_noindex', 'no_structured_data'],
    why: {
      no_h1:
        'VERIFIED against the raw HTML: the page contains zero <h1> tags. My first label ' +
        'assumed it had one and was wrong — the finding is correct.',
      missing_faq_markup: 'Many question-shaped headings, no FAQPage JSON-LD.',
      skipped_heading_levels: 'Heading levels jump; confirmed in the outline.',
      js_dependent: 'Server-rendered WordPress; the text is in the served HTML.',
      meta_noindex: 'A live commercial homepage is indexable.',
      no_structured_data: 'The page does carry JSON-LD blocks.',
    },
  },
  'cloudflare-workers-ai': {
    expect: ['no_structured_data', 'skipped_heading_levels'],
    reject: ['no_h1', 'no_canonical', 'weak_title'],
    why: {
      no_structured_data: 'No JSON-LD on this marketing page.',
      skipped_heading_levels: 'Heading levels jump in the outline.',
      no_h1: 'Marketing page with a clear H1.',
      no_canonical: 'Declares a canonical link.',
      weak_title: 'Has a long, descriptive title.',
    },
  },
  'sanjayshankar-ai-search': {
    expect: ['high_anaphora'],
    reject: ['no_structured_formats', 'no_h1', 'js_dependent', 'meta_noindex', 'weak_title'],
    why: {
      high_anaphora:
        'Several passages open with "it" or "this"; they would not survive being quoted alone.',
      no_structured_formats:
        'VERIFIED by counting passage kinds: 16 list items and 27 table cells. My first ' +
        'label assumed the article was pure prose and was wrong — the check is right to stay silent.',
      no_h1: 'The H1 lives inside <header>, which must NOT be suppressed (F15).',
      js_dependent: 'Server-rendered; text present in the served HTML.',
      meta_noindex: 'A published article is indexable.',
      weak_title: 'Title is long and specific.',
    },
  },
  'sanjayshankar-home': {
    expect: ['long_sentences'],
    reject: ['no_h1', 'meta_noindex', 'js_dependent'],
    why: {
      long_sentences: 'The intro paragraph runs long enough to be hard to quote.',
      no_h1: 'Homepage has an H1.',
      meta_noindex: 'A live homepage is indexable.',
      js_dependent: 'Server-rendered; text present in the served HTML.',
    },
  },
}
