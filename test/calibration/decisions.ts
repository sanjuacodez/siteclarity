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


  // ==========================================================================
  // Expansion to ~50 cases, 2026-09-23.
  //
  // Nineteen cases proved false positives were absent; it did not make "95%" a
  // number worth quoting. The additions lean deliberately on NEAR-MISSES — cases a
  // careless check would get wrong — because agreement on easy cases measures very
  // little.
  // ==========================================================================

  // ---- answers_heading -----------------------------------------------------
  {
    id: 'answers_heading/statement-heading',
    question: 'answers_heading',
    state: sec('Refund policy',
      'Every Acme Checkout licence can be refunded in full within 30 days of purchase.'),
    expect: true,
    why: 'A heading need not be a question to be answered; this one names a topic and the text covers it.',
  },
  {
    id: 'answers_heading/adjacent-topic',
    question: 'answers_heading',
    state: sec('How do I install it?',
      'Acme Checkout requires WordPress 6.0, PHP 8.0 and WooCommerce 7.0 or later. ' +
      'It uses about 12 MB of memory on a typical store.'),
    expect: false,
    why: 'Requirements are not installation steps — a near-miss that reads relevant but answers a different question.',
  },
  {
    id: 'answers_heading/jargon-explained',
    question: 'answers_heading',
    state: sec('What is a conditional field?',
      'A conditional field appears only when an earlier answer matches a rule you set — ' +
      'for example, showing a VAT number box only to business buyers.'),
    expect: true,
    why: 'Defines the term the heading asks about, with an example.',
  },
  {
    id: 'answers_heading/partial-answer',
    question: 'answers_heading',
    state: sec('Which currencies are supported?',
      'Acme Checkout supports every currency WooCommerce supports. Formatting follows your ' +
      'store locale.'),
    expect: true,
    why: 'Indirect but genuinely answering — deferring to the host platform is a real answer.',
  },

  // ---- self_contained ------------------------------------------------------
  {
    id: 'self_contained/refers-to-a-table',
    question: 'self_contained',
    state: sec('Choosing a plan',
      'As the table above shows, the second option suits most stores. Pick that one unless ' +
      'you need the features listed in the final column.'),
    expect: false,
    why: 'Depends entirely on a table the quoted text does not contain.',
  },
  {
    id: 'self_contained/acronym-defined',
    question: 'self_contained',
    state: sec('VAT handling',
      'Value Added Tax (VAT) is calculated from the billing country. Acme Checkout stores the ' +
      'VAT number against the order so your accountant can reconcile it later.'),
    expect: true,
    why: 'Defines its acronym on first use; later uses resolve within the passage.',
  },
  {
    id: 'self_contained/numbered-step',
    question: 'self_contained',
    state: sec('Step 3',
      'Now click Save. The rule takes effect immediately and applies to new orders only.'),
    expect: false,
    why: 'A mid-sequence step: "Now" and "the rule" both point outside the passage.',
  },
  {
    id: 'self_contained/long-but-standalone',
    question: 'self_contained',
    state: sec('How pricing rules are applied',
      'Acme Checkout evaluates pricing rules in the order they appear in the settings screen. ' +
      'The first rule whose conditions match sets the price, and no later rule overrides it. ' +
      'A store owner can reorder rules by dragging them.'),
    expect: true,
    why: 'Long and referential-sounding, but every reference resolves inside the text.',
  },

  // ---- extraction_readiness ------------------------------------------------
  {
    id: 'extraction_readiness/needs-context',
    question: 'extraction_readiness',
    state: sec('The second approach',
      'This one trades a little setup time for much better control, and most larger stores ' +
      'end up preferring it once their catalogue grows past a few hundred products.'),
    expect: 'needs_context',
    why: 'Contains real information but is meaningless without knowing what the first approach was.',
  },
  {
    id: 'extraction_readiness/table-answer',
    question: 'extraction_readiness',
    state: sec('Plan comparison',
      'Single site: $49 per year, one store, email support. Agency: $129 per year, five ' +
      'stores, priority support. Both include updates for twelve months.'),
    expect: 'ready',
    why: 'Dense, factual and quotable exactly as written.',
  },
  {
    id: 'extraction_readiness/cta-only',
    question: 'extraction_readiness',
    state: sec('Ready to get started?', 'Start your free trial today and see the difference for yourself.'),
    expect: 'absent',
    why: 'A call to action carries no answer to anything.',
  },

  // ---- promotional_intensity ----------------------------------------------
  {
    id: 'promotional_intensity/balanced',
    question: 'promotional_intensity',
    state: sec('Why teams pick Acme',
      'Acme Checkout handles conditional fields, which most alternatives do not. It is a good ' +
      'fit if your checkout needs rules; if you only need to reorder fields, a simpler plugin ' +
      'will do.'),
    expect: 2,
    why: 'Sells, but honestly, and tells you when not to buy — squarely mid-rubric.',
  },
  {
    id: 'promotional_intensity/mostly-promotional',
    question: 'promotional_intensity',
    state: sec('The Acme difference',
      'Acme Checkout delivers an outstanding experience that merchants love. Our powerful, ' +
      'flexible platform makes checkout effortless. It supports conditional fields.'),
    expect: 3,
    why: 'One fact carried along by three sentences of adjectives.',
  },
  {
    id: 'promotional_intensity/changelog',
    question: 'promotional_intensity',
    state: sec('Version 4.2.0',
      'Fixed a rounding error in percentage discounts. Added Mollie as a gateway option. ' +
      'Removed the deprecated shortcode introduced in 3.8.'),
    expect: 0,
    why: 'A changelog is the least promotional prose a product page contains.',
  },

  // ---- entity_clarity ------------------------------------------------------
  {
    id: 'entity_clarity/title-only',
    question: 'entity_clarity',
    state: {
      url: 'https://acme.example/features',
      title: 'Acme Checkout — features',
      meta_description: 'What the plugin does.',
      headings: ['# Features', '## Conditional fields'],
      opening_text: 'Our plugin lets you show and hide fields based on what the buyer picks. ' +
        'We handle the validation for you.',
    },
    expect: null,
    why: 'Named in the title but only "our plugin" in the body — genuinely borderline.',
  },
  {
    id: 'entity_clarity/acronym-only',
    question: 'entity_clarity',
    state: {
      url: 'https://acme.example/acp',
      title: 'ACP',
      meta_description: 'ACP for stores.',
      headings: ['# ACP', '## Setup'],
      opening_text: 'ACP installs in minutes and works with any store. Configure ACP from the settings screen.',
    },
    expect: false,
    why: 'An undefined acronym identifies nothing to a reader or a machine.',
  },

  // ---- claim_specificity ---------------------------------------------------
  {
    id: 'claim_specificity/fake-precision',
    question: 'claim_specificity',
    state: { heading: 'Performance', text: 'Checkout can be up to 10x faster.' },
    expect: 1,
    why: '"Up to" makes the number unfalsifiable — precision-shaped, not precise.',
  },
  {
    id: 'claim_specificity/partly-specific',
    question: 'claim_specificity',
    state: { heading: 'Adoption', text: 'Over 40,000 stores use Acme Checkout today.' },
    expect: 3,
    why: 'A real figure with no source or date, so checkable in principle only.',
  },
  {
    id: 'claim_specificity/scoped-and-sourced',
    question: 'claim_specificity',
    state: { heading: 'Performance', text: 'Rendering fell from 420 ms to 180 ms between 4.1 and 4.2, measured on a 4-core VPS across 1,000 runs.' },
    expect: 4,
    why: 'Quantified, scoped, versioned and reproducible.',
  },

  // ---- improvement_type ----------------------------------------------------
  //
  // This question drives every tailored suggestion and had NO calibration cases at
  // all — the most-used output in the product was the least measured.
  {
    id: 'improvement_type/needs-a-number',
    question: 'improvement_type',
    state: sec('Performance', 'Acme Checkout is dramatically faster than the alternatives you have tried.'),
    expect: 'add_a_number',
    why: 'Asserts speed with no figure; a number is the obvious missing piece.',
  },
  {
    id: 'improvement_type/needs-proof',
    question: 'improvement_type',
    state: sec('Trusted by merchants', 'Thousands of stores rely on Acme Checkout every single day for their busiest sales.'),
    expect: 'cite_evidence',
    why: 'A trust claim wants a named customer or case study more than another adjective.',
  },
  {
    id: 'improvement_type/needs-definition',
    question: 'improvement_type',
    state: sec('Conditional logic', 'Acme Checkout supports full conditional logic across all field types and rule sets.'),
    expect: null,
    why:
      'RELABELLED to ambiguous after the criteria were sharpened. Both answers are ' +
      'defensible: "conditional logic" is jargon to a newcomer, but it is also common ' +
      'enough that an example would help more than a definition. Asserting one answer ' +
      'was my error. What this case now measures is whether the model recognises the ' +
      'ambiguity — and it does not: it answers give_an_example at 0.99. Being near-' +
      'certain on a debatable question is itself the finding worth keeping visible.',
  },
  {
    id: 'improvement_type/already-fine',
    question: 'improvement_type',
    state: sec('Requirements', 'Acme Checkout needs WordPress 6.0, PHP 8.0 and WooCommerce 7.0. It uses 12 MB of memory.'),
    expect: 'already_specific',
    why: 'Concrete and checkable; flagging it would be a false positive on the suggestion path.',
  },

  // ---- adversarial: things a careless check gets wrong ----------------------
  {
    id: 'adversarial/question-heading-rhetorical',
    question: 'answers_heading',
    state: sec('Tired of clunky checkouts?',
      'Acme Checkout replaces the default WooCommerce checkout with one you can configure ' +
      'field by field, without touching code.'),
    expect: true,
    why: 'A rhetorical heading still gets a real response; not every question needs a literal answer.',
  },
  {
    id: 'adversarial/numbers-but-vague',
    question: 'claim_specificity',
    state: { heading: 'Scale', text: 'Millions of shoppers benefit from faster checkouts every year.' },
    expect: 1,
    why: '"Millions" and "every year" look quantitative but commit to nothing checkable.',
  },
  {
    id: 'adversarial/negative-claim',
    question: 'promotional_intensity',
    state: sec('What it does not do',
      'Acme Checkout does not handle subscriptions, multi-currency pricing or tax filing. ' +
      'If you need those, look at a dedicated plugin instead.'),
    expect: 0,
    why: 'Anti-promotional copy. Scoring it as promotional would be a plain error.',
  },

  // ---- evidence_supports_claim (module 2) -----------------------------------
  //
  // The one judgement the deterministic side cannot make. Proximity is measured; whether
  // the proof is ABOUT the claim is not.
  {
    id: 'evidence/relevant-figure',
    question: 'evidence_supports_claim',
    state: {
      claim: 'Acme Checkout renders dramatically faster than the default checkout.',
      claim_is_about: 'speed or efficiency',
      supporting_detail: 'Rendering completes in 180 ms, down from 420 ms in version 4.1.',
    },
    expect: true,
    why: 'A speed claim backed by a speed measurement.',
  },
  {
    id: 'evidence/wrong-metric',
    question: 'evidence_supports_claim',
    state: {
      claim: 'Acme Checkout renders dramatically faster than the default checkout.',
      claim_is_about: 'speed or efficiency',
      supporting_detail: 'Over 40,000 stores have installed Acme Checkout.',
    },
    expect: false,
    why:
      'The exact failure this question exists for: a real figure that measures ' +
      'popularity, not speed. A page carrying it looks evidenced while proving nothing.',
  },
  {
    id: 'evidence/popularity-supports-popularity',
    question: 'evidence_supports_claim',
    state: {
      claim: 'Acme Checkout is the most widely used checkout plugin for WooCommerce.',
      claim_is_about: 'market position',
      supporting_detail: 'Over 40,000 stores have installed Acme Checkout.',
    },
    expect: true,
    why: 'Same figure as above, now supporting the claim it actually measures.',
  },
  {
    id: 'evidence/date-does-not-prove-ease',
    question: 'evidence_supports_claim',
    state: {
      claim: 'Setting up Acme Checkout is effortless and needs no code at all.',
      claim_is_about: 'how little effort it takes',
      supporting_detail: 'Acme has been shipping since 2019.',
    },
    expect: false,
    why: 'Longevity says nothing about ease of setup — near-miss evidence.',
  },
  {
    id: 'evidence/security-certification',
    question: 'evidence_supports_claim',
    state: {
      claim: 'Every order is handled securely and in line with data protection rules.',
      claim_is_about: 'security or compliance',
      supporting_detail: 'Acme is SOC 2 Type II audited and GDPR compliant.',
    },
    expect: true,
    why: 'A named audit is the right kind of proof for a security claim.',
  },
  {
    id: 'evidence/ambiguous-support',
    question: 'evidence_supports_claim',
    state: {
      claim: 'Merchants see better conversion after switching to Acme Checkout.',
      claim_is_about: 'a result for the customer',
      supporting_detail: 'One store reported a 12% lift in completed orders.',
    },
    expect: null,
    why:
      'A single store is evidence of something, but not of "merchants" generally. ' +
      'Either answer is defensible, so the honest outcome is low confidence.',
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
