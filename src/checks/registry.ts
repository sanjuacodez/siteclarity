/**
 * The single registry of every check and question catalogue.
 *
 * Modules 2 and 3 shipped eight checks that never appeared on the /checks page, because
 * `checks.ts` imported some catalogues and not others. A registry alone would only move
 * that mistake — you would still have to remember to add to it.
 *
 * What removes the failure mode is `test/unit/registry.test.ts`: it discovers every
 * catalogue export on disk with `import.meta.glob` and fails if one is not registered
 * here. Forgetting is then caught by the suite rather than by a user noticing a missing
 * section.
 */
import { STATIC_TEMPLATES } from '../static/structure/templates'
import { LANGUAGE_TEMPLATES } from '../static/language/signals'
import { EVIDENCE_TEMPLATES } from '../static/evidence/templates'
import { MESSAGING_TEMPLATES, MESSAGING_JUDGED } from '../static/messaging/templates'
import {
  SITE_TEMPLATES,
  SITE_AUDIENCE_TEMPLATES,
  SITE_QUESTIONS,
  JOURNEY_TEMPLATES,
} from '../semantic/site'
import {
  JOURNEY_QUESTIONS,
  PAGE_QUESTIONS,
  SECTION_QUESTIONS,
  PASSAGE_QUESTIONS,
  EVIDENCE_QUESTIONS,
  MESSAGING_QUESTIONS,
} from '../semantic/questions'
import { CHECKS } from '../assemble/checks'
import type { Question } from '../provider/types'
import { ProfileDimension, type ModuleId } from '../contracts'

/**
 * What the checks page needs from a template. Deliberately narrower than
 * `StaticTemplate`: the language catalogue has no `pageLevel`, because its findings are
 * always passage-anchored, and documentation does not care either way.
 */
export interface DocumentedTemplate {
  priority: 'high' | 'medium' | 'low'
  observation: string
  whyItMatters: string
  recommendedAction: string
}

export interface CatalogueGroup {
  /** Anchor id on the checks page. */
  id: string
  title: string
  description: string
  module: ModuleId
  templates: Record<string, DocumentedTemplate>
}

export interface QuestionGroup {
  title: string
  description: string
  catalogue: Record<string, Question>
}

/**
 * Template catalogues, in the order they should be read: deterministic checks first,
 * because those run whether or not a decision model is reachable.
 */
export const TEMPLATE_GROUPS: CatalogueGroup[] = [
  {
    id: 'structure',
    title: 'Page structure',
    module: 'ai_readiness',
    description: 'Markup and shape. These run even when the decision model is unavailable.',
    templates: STATIC_TEMPLATES,
  },
  {
    id: 'language',
    title: 'Language signals',
    module: 'ai_readiness',
    description:
      'Measured from the text itself — pronoun-heavy openings, vague quantifiers, sentence length. English only.',
    templates: LANGUAGE_TEMPLATES,
  },
  {
    id: 'trust',
    title: 'Evidence & trust',
    module: 'evidence_trust',
    description:
      'A passage counts as a claim only when it carries both a superlative and one of six claim families. Whether nearby proof is actually about the claim is the one judgement left to the model.',
    templates: EVIDENCE_TEMPLATES,
  },
  {
    id: 'site',
    title: 'Across the site',
    module: 'audience_coverage',
    description:
      'Checks that need several pages together. Every page is judged on its own first; these count those judgements rather than re-reading anything, so they cost one short call over an inventory of page summaries.',
    templates: { ...SITE_TEMPLATES, ...SITE_AUDIENCE_TEMPLATES },
  },
  {
    id: 'journey',
    title: 'Buyer journey',
    module: 'buyer_journey',
    description:
      'Which moments in a buying decision the site writes for, and which it leaves empty. Each page is placed at a stage individually; the gaps are then arithmetic.',
    templates: JOURNEY_TEMPLATES,
  },
  {
    id: 'messaging',
    title: 'Messaging',
    module: 'messaging',
    description:
      'Whether the page makes its case: the problem it solves, who it is for, what makes it different, and whether the next step says what it does.',
    templates: { ...MESSAGING_TEMPLATES, ...MESSAGING_JUDGED },
  },
]

/** Question catalogues, grouped by the scope of state they are asked against. */
export const QUESTION_GROUPS: QuestionGroup[] = [
  {
    title: 'About the whole page',
    description: 'Asked once, against a compact page-scope state.',
    catalogue: PAGE_QUESTIONS,
  },
  {
    title: 'About one section',
    description:
      'Asked once per section, against that section alone — feeding in the surrounding page would corrupt the self-containment answer.',
    catalogue: SECTION_QUESTIONS,
  },
  {
    title: 'About one passage',
    description: 'Asked per candidate claim.',
    catalogue: PASSAGE_QUESTIONS,
  },
  {
    title: 'Claim and evidence',
    description:
      'Asked once per claim that has evidence nearby. Proximity is measured; whether the proof is about the claim is not.',
    catalogue: EVIDENCE_QUESTIONS,
  },
  {
    title: 'Buyer journey',
    description: 'Asked once per page, riding in the existing page-scope call.',
    catalogue: JOURNEY_QUESTIONS,
  },
  {
    title: 'Across the site',
    description:
      'Asked once over an inventory of page summaries — one short line per page, so twenty-five pages cost about a thousand tokens.',
    catalogue: SITE_QUESTIONS,
  },
  {
    title: 'Messaging',
    description:
      'Asked against the page-scope state. These are properties of the whole argument rather than of one section.',
    catalogue: MESSAGING_QUESTIONS,
  },
]

/**
 * The ten planned modules, in build order, with what each covers.
 *
 * Built state is DERIVED from whether a catalogue references the module, never written
 * down — the checks page previously said "two are built" while three were, because the
 * count was prose someone had to remember to update.
 */
export const MODULE_INFO: Record<ModuleId, { label: string; blurb: string }> = {
  ai_readiness: {
    label: 'Answer readiness',
    blurb:
      'Can a search engine or AI assistant find, understand and quote the answers on this page? Structured data, heading hierarchy, extractability, self-containment, promotional density, buried answers.',
  },
  evidence_trust: {
    label: 'Evidence & trust',
    blurb:
      'Does each marketing claim have proof beside it? Claims and evidence are both located deterministically and the distance between them is measured. Whether nearby proof is actually about the claim is the one judgement left to the model.',
  },
  messaging: {
    label: 'Messaging',
    blurb:
      'Does the page make its case? Whether it names the problem it solves, says who it is for, says what makes it different, and offers a next step that states what it does.',
  },
  website_understanding: {
    label: 'Website understanding',
    blurb:
      'What the page says it does, who for, the problem it solves and what makes it different — shown as the page’s own sentences. The model selects which sentence states each thing; it never writes one, so a dimension the page does not address is reported as not stated rather than paraphrased into existence.',
  },
  question_coverage: {
    label: 'Question coverage',
    blurb: 'Which buyer questions the site answers, partly answers, or leaves unanswered.',
  },
  buyer_journey: {
    label: 'Buyer journey',
    blurb: 'Whether content exists for each stage from awareness through to decision.',
  },
  audience_coverage: {
    label: 'Audience coverage',
    blurb: 'Which audiences the content actually addresses, against those it intends to.',
  },
  product_portfolio: {
    label: 'Product portfolio',
    blurb: 'How marketing coverage compares across several products or services.',
  },
  content_overlap: {
    label: 'Content overlap',
    blurb: 'Pages competing for the same topic or intent.',
  },
  content_opportunity: {
    label: 'Opportunities',
    blurb: 'A prioritised roll-up of everything the other modules found.',
  },
}

/**
 * Modules with real output behind them. Derived from code, never declared.
 *
 * Most modules are built by having a template catalogue — they emit findings. Module 4
 * emits no findings at all: it produces a descriptive profile, so it has no templates and
 * would otherwise read as unbuilt. Its evidence of existence is the profile dimensions,
 * which is still derived rather than asserted.
 */
export function builtModules(): ModuleId[] {
  const built = new Set<ModuleId>(TEMPLATE_GROUPS.map((g) => g.module))
  if (CHECKS.length > 0) built.add('ai_readiness')
  if (ProfileDimension.options.length > 0) built.add('website_understanding')
  return (Object.keys(MODULE_INFO) as ModuleId[]).filter((m) => built.has(m))
}

/** Modules whose output is a description rather than findings. */
export const PROFILE_MODULES: ModuleId[] = ['website_understanding']

export function plannedModules(): ModuleId[] {
  const built = new Set(builtModules())
  return (Object.keys(MODULE_INFO) as ModuleId[]).filter((m) => !built.has(m))
}

/** Every check id the product can emit, from every source. */
export function allCheckIds(): string[] {
  return [
    ...TEMPLATE_GROUPS.flatMap((g) => Object.keys(g.templates)),
    ...CHECKS.map((c) => c.id),
  ]
}

/** Every question id the product can ask. */
export function allQuestionIds(): string[] {
  return QUESTION_GROUPS.flatMap((g) => Object.keys(g.catalogue))
}

/**
 * Catalogue export names registered above. The discovery test compares this against
 * what actually exists on disk, so adding a catalogue and forgetting to register it
 * fails the suite instead of silently dropping a section from the checks page.
 */
export const REGISTERED_EXPORTS = [
  'STATIC_TEMPLATES',
  'LANGUAGE_TEMPLATES',
  'EVIDENCE_TEMPLATES',
  'MESSAGING_TEMPLATES',
  'MESSAGING_JUDGED',
  'PAGE_QUESTIONS',
  'SECTION_QUESTIONS',
  'PASSAGE_QUESTIONS',
  'EVIDENCE_QUESTIONS',
  'MESSAGING_QUESTIONS',
  'SITE_TEMPLATES',
  'SITE_AUDIENCE_TEMPLATES',
  'SITE_QUESTIONS',
  'JOURNEY_TEMPLATES',
  'JOURNEY_QUESTIONS',
] as const
