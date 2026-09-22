/**
 * Live calibration corpus for the DECISION layer.
 *
 * The deterministic checks have a fixture corpus proving they are right. Nothing
 * measured whether the model's judgments are right — whether "this section does not
 * answer its heading" is true when it fires. This is that measurement.
 *
 * Cases are written rather than scraped, so the ground truth is unarguable. A scraped
 * page invites debate about what the right answer even is; these do not.
 *
 * `expect: null` means the case is genuinely ambiguous and the honest outcome is low
 * confidence, which the pipeline turns into `cannot_assess`. Scoring a model as wrong
 * for hedging on a hard case would reward false confidence.
 */
export interface DecisionCase {
  id: string
  question: string
  state: Record<string, unknown>
  /** Expected answer; null when the honest answer is "not confident". */
  expect: boolean | string | number | null
  why: string
}

const sec = (heading: string, text: string) => ({
  page_title: 'Acme Checkout Plugin',
  heading,
  heading_level: 2,
  text,
})

export const DECISION_CASES: DecisionCase[] = [
  // ---- answers_heading -----------------------------------------------------
  {
    id: 'answers_heading/clear-yes',
    question: 'answers_heading',
    state: sec('How much does it cost?',
      'Acme Checkout costs $49 per year for a single site and $129 for five sites. ' +
      'Both tiers include updates and support for twelve months.'),
    expect: true,
    why: 'The heading asks a price question and the first sentence gives the price.',
  },
  {
    id: 'answers_heading/clear-no',
    question: 'answers_heading',
    state: sec('How much does it cost?',
      'We built Acme Checkout after years of frustration with clunky checkout flows. ' +
      'Our team cares deeply about merchants and we are proud of what we have made.'),
    expect: false,
    why: 'The heading asks a price question; the text is an origin story with no price.',
  },
  {
    id: 'answers_heading/answer-is-late',
    question: 'answers_heading',
    state: sec('What browsers are supported?',
      'Browser support is something we take seriously, and our approach has evolved a lot ' +
      'over the years as the web has changed and standards have matured across vendors. ' +
      'Acme Checkout supports Chrome, Firefox, Safari and Edge from their last two releases.'),
    expect: true,
    why:
      'RELABELLED 2026-09-23 because the QUESTION changed, not because of an output. ' +
      'It used to claim the answer must appear "near the start", which made this case ' +
      'ambiguous. It now asks whether the answer is present at all, however far down — ' +
      'and it plainly is. Burial is `extraction_readiness`\u2019s job.',
  },

  // ---- self_contained ------------------------------------------------------
  {
    id: 'self_contained/clear-yes',
    question: 'self_contained',
    state: sec('Refund policy',
      'Acme Checkout refunds any licence in full within 30 days of purchase. ' +
      'Email support@acme.example with the order number to start a refund.'),
    expect: true,
    why: 'Names its subject and needs nothing from elsewhere on the page.',
  },
  {
    id: 'self_contained/clear-no',
    question: 'self_contained',
    state: sec('How it works',
      'It does this automatically once you have done that. They are applied in the same ' +
      'order as above, and this means you rarely have to touch it again afterwards.'),
    expect: false,
    why: 'Every subject is a pronoun; quoted alone it means nothing.',
  },

  // ---- extraction_readiness ------------------------------------------------
  {
    id: 'extraction_readiness/ready',
    question: 'extraction_readiness',
    state: sec('What is a checkout field?',
      'A checkout field is an input on the checkout page that collects information from ' +
      'the buyer, such as a delivery note or a VAT number. Acme Checkout lets you add, ' +
      'reorder and validate these fields without code.'),
    expect: 'ready',
    why: 'A direct, self-contained definition that could be quoted verbatim.',
  },
  {
    id: 'extraction_readiness/absent',
    question: 'extraction_readiness',
    state: sec('Why choose Acme?', 'Read on to find out more about what makes us different.'),
    expect: 'absent',
    why: 'A heading promising information followed by nothing but a teaser.',
  },
  {
    id: 'extraction_readiness/buried',
    question: 'extraction_readiness',
    state: sec('Does it work with WooCommerce?',
      'Compatibility is a topic we get asked about constantly, and it is worth explaining ' +
      'our philosophy first. We believe plugins should be good citizens and never fight ' +
      'the host platform, which has guided every decision we have made since 2019. ' +
      'Yes, Acme Checkout works with WooCommerce 7.0 and later.'),
    expect: 'buried',
    why:
      'KNOWN FAILURE, kept deliberately. The answer sits behind three sentences of ' +
      'preamble, so "buried" is right — but the model returns "ready" at 0.39 and ' +
      '"buried" at 0.34 across runs, never confident either way. It is weak at ' +
      'detecting burial. Relabelling this to match the output would hide a real ' +
      'limitation; leaving it red keeps the gap visible. The low confidence means the ' +
      'pipeline discards it rather than reporting the wrong thing, so nobody is misled.',
  },

  // ---- promotional_intensity (rubric index, 0 = factual, 4 = all superlatives)
  {
    id: 'promotional_intensity/factual',
    question: 'promotional_intensity',
    state: sec('Technical requirements',
      'Acme Checkout requires WordPress 6.0 or later, PHP 8.0 or later, and WooCommerce ' +
      '7.0 or later. It uses 12 MB of memory on a typical install.'),
    expect: 0,
    why: 'Specifications only; nothing is being sold.',
  },
  {
    id: 'promotional_intensity/heavy',
    question: 'promotional_intensity',
    state: sec('The best checkout plugin',
      'Acme is the world-class, best-in-class, industry-leading checkout solution that ' +
      'delivers unmatched results with our revolutionary and seamless technology. ' +
      'Simply the finest experience available anywhere today.'),
    expect: 4,
    why: 'Almost every clause is a superlative with no fact attached.',
  },

  // ---- entity_clarity ------------------------------------------------------
  {
    id: 'entity_clarity/named',
    question: 'entity_clarity',
    state: {
      url: 'https://acme.example/checkout',
      title: 'Acme Checkout — field editor for WooCommerce',
      meta_description: 'Add and validate checkout fields.',
      headings: ['# Acme Checkout', '## Pricing'],
      opening_text: 'Acme Checkout adds custom fields to the WooCommerce checkout page.',
    },
    expect: true,
    why: 'The product is named in the title, a heading and the opening line.',
  },
  {
    id: 'entity_clarity/anonymous',
    question: 'entity_clarity',
    state: {
      url: 'https://acme.example/',
      title: 'Welcome',
      meta_description: 'We build software.',
      headings: ['# Welcome', '## What we do'],
      opening_text: 'We are passionate about building tools our customers love. ' +
        'Our platform helps teams work better together every single day.',
    },
    expect: false,
    why: 'Only "we" and "our platform"; nothing identifies the subject.',
  },

  // ---- adversarial: near-misses that must NOT fire --------------------------
  //
  // Added to validate the per-primitive thresholds from F28. Lowering the Choice bar
  // recovers correct answers like `buried`; these exist to prove it does not also
  // start reporting problems that are not there.
  {
    id: 'adversarial/short-but-complete',
    question: 'answers_heading',
    state: sec('Is there a free trial?', 'No. Acme Checkout has no free trial, but every licence is refundable for 30 days.'),
    expect: true,
    why: 'Terse is not the same as unanswered — a two-sentence answer is still an answer.',
  },
  {
    id: 'adversarial/list-answer',
    question: 'extraction_readiness',
    state: sec('Which payment gateways are supported?',
      'Acme Checkout works with Stripe, PayPal, Adyen and Mollie. Support for Klarna is planned for 2026.'),
    expect: 'ready',
    why: 'A compact factual list is the most extractable shape there is; flagging it would be a false positive.',
  },
  {
    id: 'adversarial/confident-prose',
    question: 'self_contained',
    state: sec('Validation rules',
      'Validation rules run when a buyer submits the checkout form. Each rule names the field it ' +
      'guards, so a rule can be read on its own without seeing the others.'),
    expect: true,
    why: 'Mentions "each rule" but defines it in place; not every reference is an unresolved one.',
  },
  {
    id: 'adversarial/technical-not-promotional',
    question: 'promotional_intensity',
    state: sec('Caching behaviour',
      'Field definitions are cached for 300 seconds. The cache is cleared automatically when a ' +
      'rule changes, and can be flushed manually from the settings screen.'),
    expect: 0,
    why: 'Dry technical prose. Scoring this as promotional would be a clear false positive.',
  },
  {
    id: 'adversarial/mild-positive',
    question: 'promotional_intensity',
    state: sec('Why merchants use it',
      'Acme Checkout is a reliable way to add checkout fields. Most stores finish setup in ' +
      'about ten minutes, and the plugin has 40,000 active installs.'),
    expect: 1,
    why: 'Light positive framing carrying real figures — not the same as empty hype.',
  },

  // ---- claim specificity ---------------------------------------------------
  {
    id: 'claim_specificity/specific',
    question: 'claim_specificity',
    state: { heading: 'Performance', text: 'Checkout renders in 180 ms on a 4-core VPS, measured across 1,000 runs in March 2026.' },
    expect: 4,
    why: 'Quantified, scoped, dated and attributable.',
  },
  {
    id: 'claim_specificity/vague',
    question: 'claim_specificity',
    state: { heading: 'Performance', text: 'Checkout is dramatically faster than the alternatives.' },
    expect: 0,
    why: 'No figure, no baseline, no conditions.',
  },
]
