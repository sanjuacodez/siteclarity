/**
 * SC-106 — finding copy for the deterministic checks.
 *
 * Same discipline as the model-driven checks: templates with slots, never generated.
 * `{slot}` names match the `slots` returned by the check.
 */
export interface StaticTemplate {
  priority: 'high' | 'medium' | 'low'
  observation: string
  whyItMatters: string
  recommendedAction: string
  /** True when the finding is about the page as a whole rather than a passage. */
  pageLevel: boolean
}

export const STATIC_TEMPLATES: Record<string, StaticTemplate> = {
  no_structured_data: {
    priority: 'medium',
    pageLevel: true,
    observation: 'This page has no structured data.',
    whyItMatters:
      'Structured data tells search engines and AI what kind of page this is, instead of making them guess. Pages that spell it out are easier to trust and reuse.',
    recommendedAction:
      'Add a JSON-LD block saying what this page is — an article, a product, an FAQ — with a name, a description, and who wrote it.',
  },
  malformed_structured_data: {
    priority: 'high',
    pageLevel: true,
    observation: '{count} structured-data block(s) on this page are broken.',
    whyItMatters:
      'A broken block is ignored completely, so the work of adding it is wasted — and it looks like the page has structured data when it does not.',
    recommendedAction:
      'Run the JSON-LD through a validator and fix the error. It is usually a stray comma or a missing quote.',
  },
  missing_faq_markup: {
    priority: 'medium',
    pageLevel: true,
    observation: 'This page has {count} question headings but no FAQ markup.',
    whyItMatters:
      'This page is already written as questions and answers. Marking it up properly makes it directly usable by AI tools — without it, they have to guess which answer goes with which question.',
    recommendedAction:
      'Add FAQ structured data linking each question heading to its answer.',
  },
  no_h1: {
    priority: 'medium',
    pageLevel: true,
    observation: 'This page has no H1.',
    whyItMatters:
      'The H1 is the clearest signal of what a page is about. Without one, search engines fall back to the title tag or guess from the text.',
    recommendedAction: 'Add one H1 that plainly says what the page is about.',
  },
  multiple_h1: {
    priority: 'low',
    pageLevel: true,
    observation: 'This page has {count} H1 headings.',
    whyItMatters:
      'With more than one H1, it is unclear what the page is mainly about. Search engines have to pick one, and it may not be the one you want.',
    recommendedAction:
      'Keep one H1 — currently “{first}” — and change the others to H2.',
  },
  skipped_heading_levels: {
    priority: 'low',
    pageLevel: true,
    observation: 'Heading levels jump around in {count} place(s).',
    whyItMatters:
      'Heading levels show how sections sit inside each other. Skipping one makes the page outline confusing to anything reading the structure rather than the design.',
    recommendedAction: 'Go one level at a time — {example}.',
  },
  no_structured_formats: {
    priority: 'medium',
    pageLevel: true,
    observation: 'The page is {count} paragraphs with no lists or tables.',
    whyItMatters:
      'AI tools pull lists and tables much more easily than paragraphs, because it is obvious where the answer starts and stops. In solid prose, they have to guess.',
    recommendedAction:
      'Turn the steps, comparisons and option lists into bullet points or a table. Same words, different shape.',
  },
  passages_too_long: {
    priority: 'low',
    pageLevel: false,
    observation: '{count} paragraph(s) are too long to quote — the longest is {longest} words.',
    whyItMatters:
      'A very long paragraph cannot be quoted without cutting it off, so tools usually pick something shorter from another site.',
    recommendedAction:
      'Split these into shorter paragraphs, one point each.',
  },
  meta_noindex: {
    priority: 'high',
    pageLevel: true,
    observation: 'This page tells search engines not to list it ({value}).',
    whyItMatters:
      'While this tag is there, the page will not show up in search at all. If that is on purpose, ignore this. If not, fix this before anything else.',
    recommendedAction: 'Remove “noindex” from the robots meta tag if this page should be findable.',
  },
  meta_noai: {
    priority: 'high',
    pageLevel: true,
    observation: 'This page tells AI tools not to use it ({value}).',
    whyItMatters:
      'This tells AI tools not to use your content. That may be what you want — but if not, nothing else on this page will help.',
    recommendedAction: 'Remove the “noai” tag if you want AI tools to use this page.',
  },
  no_canonical: {
    priority: 'low',
    pageLevel: true,
    observation: 'This page declares no canonical URL.',
    whyItMatters:
      'Without one, the same page reachable at several web addresses competes with itself and the credit gets split.',
    recommendedAction: 'Add a canonical link pointing at the address you want people to land on.',
  },
  canonical_offsite: {
    priority: 'high',
    pageLevel: true,
    observation: 'The canonical link points at a different website.',
    whyItMatters:
      'This tells search engines the real version of this page lives on another site, handing them the credit. It is almost always a mistake.',
    recommendedAction: 'Point the canonical at this page, unless the content really does belong to {canonical}.',
  },
  canonical_invalid: {
    priority: 'medium',
    pageLevel: true,
    observation: 'The canonical link is not a valid address ({canonical}).',
    whyItMatters: 'A broken canonical is ignored, so the page behaves as if it had none at all.',
    recommendedAction: 'Fix it to a full, valid web address.',
  },
  weak_title: {
    priority: 'medium',
    pageLevel: true,
    observation: 'The page title is missing or very short.',
    whyItMatters:
      'The title is what shows in search results, in citations and when someone shares the link. A weak one costs you everywhere it appears.',
    recommendedAction: 'Write a title that says specifically what the page is about, in about 50 to 60 characters.',
  },
  no_meta_description: {
    priority: 'low',
    pageLevel: true,
    observation: 'This page has no meta description.',
    whyItMatters:
      'Without one, search engines grab whatever text comes first — often a menu or an intro line rather than a summary.',
    recommendedAction: 'Add one sentence describing what this page answers.',
  },
  js_dependent: {
    priority: 'high',
    pageLevel: true,
    observation: 'This page builds its content with JavaScript.',
    whyItMatters:
      'The page sends almost no text to start with. Many AI tools do not run JavaScript, so they may see a nearly empty page where a visitor sees a full one.',
    recommendedAction:
      'Make the main content part of the page that is sent first, rather than loading it afterwards.',
  },
}
