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


/**
 * Module 6 — Buyer journey.
 *
 * Every page has already been given a stage individually; this counts them. The brief's
 * example finding is exactly this shape: "extensive educational content, but very little
 * comparison or decision-stage content."
 *
 * Reported as gaps rather than as a coverage score. Which stage is missing is actionable;
 * "journey coverage 4/6" is not.
 */
export const JOURNEY_STAGES = [
  'awareness',
  'education',
  'consideration',
  'comparison',
  'decision',
  'purchase',
] as const

export const STAGE_LABELS: Record<string, string> = {
  awareness: 'people who do not yet know solutions exist',
  education: 'people learning how the problem is solved',
  consideration: 'people working out whether this fits them',
  comparison: 'people weighing you against alternatives',
  decision: 'people close to committing',
  purchase: 'people ready to act',
}

/** What each missing stage costs, in the reader's terms. */
export const STAGE_COST_PUBLIC: Record<string, string> = {
  awareness:
    'Nobody arrives here while still describing the problem in their own words — and those are the searches AI assistants answer most often.',
  education:
    'People who know they have the problem but not how it is solved have nothing to read, so they learn it somewhere else and buy there too.',
  consideration:
    'Someone interested cannot tell whether this suits their situation, so they have to ask — and most will not.',
  comparison:
    'Anyone weighing you against an alternative has to build that comparison themselves, usually from a competitor’s version of it.',
  decision:
    'Someone ready to commit cannot find what it costs or what happens next, which is the easiest possible place to lose them.',
  purchase:
    'There is no obvious way to act, so intent built everywhere else on the site has nowhere to go.',
}

export function stageCounts(summaries: PageSummary[]): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const stage of JOURNEY_STAGES) counts[stage] = 0
  for (const s of summaries) {
    if (s.journeyStage && s.journeyStage in counts) counts[s.journeyStage]! += 1
  }
  return counts
}

export interface StageGap {
  stage: string
  concentratedIn: string | null
}

/**
 * Missing stages, but only once there is enough content for absence to mean something.
 *
 * A five-page site legitimately has gaps. A gap is worth reporting when the site has
 * plenty of pages and none of them serve a stage — and it reads better alongside where
 * the content actually piled up.
 */
export function findStageGaps(summaries: PageSummary[]): StageGap[] {
  const counts = stageCounts(summaries)
  const staged = Object.values(counts).reduce((a, b) => a + b, 0)
  if (staged < 4) return []

  const heaviest = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]
  const concentratedIn = heaviest && heaviest[1] >= staged / 2 ? heaviest[0] : null

  return JOURNEY_STAGES.filter((stage) => counts[stage] === 0).map((stage) => ({
    stage,
    concentratedIn,
  }))
}

export const JOURNEY_TEMPLATES: Record<string, StaticTemplate> = {
  journey_stage_missing: {
    priority: 'medium',
    pageLevel: true,
    observation: 'No page here is written for {audience}.',
    whyItMatters: '{cost}',
    recommendedAction:
      'Write one page for that moment. It does not need to be long — it needs to exist, and to use the words someone at that stage would actually type.',
  },
  journey_concentrated: {
    priority: 'medium',
    pageLevel: true,
    observation: 'Most of this site sits at one stage: {stage}.',
    whyItMatters:
      'A visitor arrives at whatever stage they are already at. When the content clusters in one place, everyone arriving earlier or later finds nothing written for them and leaves.',
    recommendedAction:
      'Spread coverage outward from where it is thickest — one page earlier in the journey and one later will reach people the rest of the site currently misses.',
  },
}

/**
 * Module 9 — Content overlap.
 *
 * Embeddings were the obvious approach and the 10 ms CPU limit forbids them. Topic-term
 * overlap between page summaries is set intersection over eight-element arrays: 25 pages
 * is 300 comparisons and costs microseconds.
 *
 * It is less subtle than similarity and will miss paraphrase entirely. That is an honest
 * trade rather than a hidden one — "these pages use the same terms and serve the same
 * moment" is a claim the evidence supports, where "these pages are semantically similar"
 * would not be.
 *
 * Shared vocabulary alone is far too loose: every page on a WooCommerce site says
 * "checkout". A pair is only reported when the terms overlap heavily AND both pages sit
 * at the same buying stage AND serve the same purpose — three independent signals
 * agreeing, because any one of them alone produces noise.
 */
const OVERLAP_RATIO = 0.6
const MIN_SHARED_TERMS = 3
const MAX_PAIRS = 5

export interface OverlapPair {
  a: PageSummary
  b: PageSummary
  shared: string[]
  ratio: number
}

export function findOverlaps(summaries: PageSummary[]): OverlapPair[] {
  const pairs: OverlapPair[] = []

  for (let i = 0; i < summaries.length; i++) {
    for (let j = i + 1; j < summaries.length; j++) {
      const a = summaries[i]!
      const b = summaries[j]!

      // Two pages can only compete if they are written for the same moment and doing
      // the same job. Without this, a guide and a pricing page sharing vocabulary
      // would be reported as rivals.
      if (!a.journeyStage || a.journeyStage !== b.journeyStage) continue
      if (!a.purpose || a.purpose !== b.purpose) continue

      const setA = new Set(a.topicTerms)
      const shared = b.topicTerms.filter((t) => setA.has(t))
      if (shared.length < MIN_SHARED_TERMS) continue

      const smaller = Math.min(a.topicTerms.length, b.topicTerms.length)
      const ratio = smaller === 0 ? 0 : shared.length / smaller
      if (ratio < OVERLAP_RATIO) continue

      pairs.push({ a, b, shared, ratio })
    }
  }

  return pairs.sort((x, y) => y.ratio - x.ratio || y.shared.length - x.shared.length).slice(0, MAX_PAIRS)
}

export const OVERLAP_TEMPLATES: Record<string, StaticTemplate> = {
  pages_compete: {
    priority: 'medium',
    pageLevel: true,
    observation: 'Two pages cover the same ground: {a} and {b}.',
    whyItMatters:
      'Both are written for the same moment, about {shared}. Search engines have to pick one and may pick neither, and a reader who lands on the weaker one never learns the other exists.',
    recommendedAction:
      'Decide which page owns this topic. Make the other point at it, narrow it to a genuinely different angle, or merge the two.',
  },
}
