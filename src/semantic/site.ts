import type { PageSummary } from '../contracts'
import type { Question } from '../provider/types'
import type { StaticTemplate } from '../static/structure/templates'

/**
 * Module 7 — Audience coverage, the first site-level module.
 *
 * The principle from scoped state holds here too: decisions are local, aggregation is
 * deterministic code. Every page has already been judged individually; this counts those
 * judgements rather than re-reading anything.
 *
 * Two of the three checks below need no model at all. The third asks one Choice over a
 * compact inventory — one short line per page, so twenty-five pages cost about a
 * thousand tokens rather than the hundreds of thousands the pages themselves would.
 */

/** Below this a site has too few pages for coverage to mean anything. */
const MIN_PAGES = 3
/** Above this share of pages selling, a site has no room left to explain. */
const SELL_HEAVY = 0.7

export interface SiteSignals {
  pages: number
  /** Pages that name who they are for. */
  audienceNamed: number
  /** Pages with no next step at all. */
  withoutAction: number
  purposes: Record<string, number>
  /** Terms shared by three or more pages, with how many. */
  sharedTopics: { term: string; pages: number }[]
}

export function readSiteSignals(summaries: PageSummary[]): SiteSignals {
  const purposes: Record<string, number> = {}
  const termPages = new Map<string, number>()

  for (const s of summaries) {
    if (s.purpose) purposes[s.purpose] = (purposes[s.purpose] ?? 0) + 1
    for (const t of new Set(s.topicTerms)) termPages.set(t, (termPages.get(t) ?? 0) + 1)
  }

  return {
    pages: summaries.length,
    audienceNamed: summaries.filter((s) => s.audienceNamed === true).length,
    withoutAction: summaries.filter((s) => !s.hasAction).length,
    purposes,
    sharedTopics: [...termPages.entries()]
      .filter(([, n]) => n >= 3)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([term, pages]) => ({ term, pages })),
  }
}

export const SITE_TEMPLATES: Record<string, StaticTemplate> = {
  audience_rarely_named: {
    priority: 'high',
    pageLevel: true,
    observation: 'Only {named} of {pages} pages say who they are for.',
    whyItMatters:
      'A visitor landing on any single page has to work out whether it is meant for them. Most will not bother, and an AI assistant has nothing to match against someone describing their own situation.',
    recommendedAction:
      'Name the reader on each page that sells something — the role, the size of business, the situation. It need not be a whole section; one sentence near the top is enough.',
  },
  site_has_no_next_step: {
    priority: 'medium',
    pageLevel: true,
    observation: '{count} of {pages} pages offer no next step.',
    whyItMatters:
      'Someone convinced by one of these pages has nowhere to go from it. Every extra click they have to invent is somewhere to lose them.',
    recommendedAction:
      'Add one clear action to each — the same action is fine, as long as it says what happens.',
  },
  site_sells_without_explaining: {
    priority: 'medium',
    pageLevel: true,
    observation: '{sell} of {pages} pages are selling; {explain} explain anything.',
    whyItMatters:
      'People search for their problem long before they search for a product. A site that only sells is invisible to everyone who has not yet decided they need one, and those are the searches AI assistants answer most.',
    recommendedAction:
      'Write for the earlier question. One page explaining the problem you solve reaches people no product page will.',
  },
}

/**
 * The one site-level question worth asking a model.
 *
 * Counting is deterministic; whether a collection of pages coheres around one audience
 * is not, and that is exactly the kind of judgement a Choice can carry.
 */
export const SITE_QUESTIONS: Record<string, Question> = {
  site_audience_consistency: {
    type: 'choice',
    instructions:
      'Reading the page titles and topics below as one site, how consistent is the audience being addressed?',
    criteria: {
      one_clear: 'One audience throughout, addressed consistently.',
      several_deliberate: 'Several distinct audiences, each looking intentional.',
      drifting: 'The audience shifts between pages without any page acknowledging it.',
      none_evident: 'No audience is identifiable from these pages at all.',
    },
  },
}

/** The inventory as model state: one short line per page, nothing else. */
export function buildSiteState(summaries: PageSummary[]): Record<string, unknown> {
  return {
    page_count: summaries.length,
    pages: summaries.map((s) => ({
      title: s.title?.slice(0, 90) ?? s.url,
      purpose: s.purpose,
      topics: s.topicTerms.slice(0, 5),
    })),
  }
}

export const SITE_AUDIENCE_TEMPLATES: Record<string, StaticTemplate> = {
  audience_drifts: {
    priority: 'high',
    pageLevel: true,
    observation: 'The audience shifts between pages without any page saying so.',
    whyItMatters:
      'Each page reads as if written for someone different, so a visitor cannot tell which parts apply to them. Serving several audiences is fine — leaving them to work out which one they are is not.',
    recommendedAction:
      'Either say on each page who it is for, or give each audience its own entry point that names them.',
  },
  audience_none_evident: {
    priority: 'high',
    pageLevel: true,
    observation: 'No audience is identifiable anywhere across these pages.',
    whyItMatters:
      'Nothing on the site tells a reader whether it is for them, so every visitor has to guess — and an AI assistant has nothing to match a person’s description of themselves against.',
    recommendedAction:
      'Decide who the site is for and say it plainly on the pages that matter most.',
  },
}

export { MIN_PAGES, SELL_HEAVY }
