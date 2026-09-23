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
  PAGE_QUESTIONS,
  SECTION_QUESTIONS,
  PASSAGE_QUESTIONS,
  EVIDENCE_QUESTIONS,
  MESSAGING_QUESTIONS,
} from '../semantic/questions'
import { CHECKS } from '../assemble/checks'
import type { Question } from '../provider/types'
import type { ModuleId } from '../contracts'

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
    title: 'Messaging',
    description:
      'Asked against the page-scope state. These are properties of the whole argument rather than of one section.',
    catalogue: MESSAGING_QUESTIONS,
  },
]

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
] as const
