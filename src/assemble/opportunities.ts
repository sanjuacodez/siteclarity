import type { Finding } from '../contracts'
import { impactTier } from './impact'
import { COVERAGE_AREAS, COVERAGE_LOOKUP, type CoverageArea } from '../semantic/coverage'

/**
 * Module 10 — Content opportunity discovery.
 *
 * A site scan produces a few dozen findings. Every one is true and actionable, and the
 * reader still does not know what to do on Monday, because a list sorted by severity is
 * not a plan: the same four words keep appearing on different pages with nothing to say
 * they are one job.
 *
 * An opportunity is ONE piece of work with the findings that justify it attached. Twelve
 * unbacked claims across nine pages are not twelve jobs; they are one.
 *
 * This module makes **no decisions at all**. Every input has already been judged, quoted
 * and verified, so grouping is arithmetic — which means opportunities still appear when
 * the decision model is switched off, because the static layer still produces findings.
 *
 * See docs/MODULE-10-DESIGN.md, particularly for why the brief's example copy ("create
 * an agency-specific landing page") is not reachable without a model that writes.
 */

/** A check firing on fewer pages than this is a page problem, not a systemic one. */
export const SYSTEMIC_PAGES = 3
/** A backlog of thirty is not a backlog. The findings remain underneath. */
export const MAX_OPPORTUNITIES = 6

export interface Opportunity {
  id: string
  /** What to do. Template copy — nothing here is written by a model. */
  title: string
  /** Why it is worth doing, in terms of what it costs to leave. */
  rationale: string
  /** Finding ids this was built from, so a reader can always get back to the evidence. */
  fromFindings: string[]
  pages: string[]
  /** Ordering only. Never rendered as a number: see invariant 2. */
  tier: number
}

/**
 * Copy for a recurring check.
 *
 * Keyed by check id and deliberately incomplete: a check with no entry here simply never
 * becomes an opportunity, which is the right default. Promoting everything would make the
 * plan longer without making it truer.
 */
const RECURRING: Record<string, { title: string; rationale: string }> = {
  claim_without_evidence: {
    title: 'Back the claims you are already making',
    rationale:
      'The same unsupported claim pattern runs through {pages} pages. A reader who doubts one doubts the rest, and an AI assistant has nothing it can attribute.',
  },
  vague_claim: {
    title: 'Put figures on the claims that carry weight',
    rationale:
      '{pages} pages make claims with no number, scope or condition attached. "Much faster" cannot be quoted as an answer to anything.',
  },
  heavily_promotional: {
    title: 'Trade the superlatives for specifics',
    rationale:
      '{pages} pages read as advertising rather than information. That is the copy an answering system skips over, because there is nothing in it to extract.',
  },
  answer_absent: {
    title: 'Answer the questions your own headings ask',
    rationale:
      'Across {pages} pages a heading promises something the text never delivers. Each one is a reader arriving with a question and leaving with it.',
  },
  not_self_contained: {
    title: 'Make sections stand on their own',
    rationale:
      '{pages} pages have sections that stop making sense when quoted away from the page. That is the form every AI answer takes.',
  },
  audience_not_named: {
    title: 'Say who each page is for',
    rationale:
      '{pages} pages never say who they are written for, so a reader has to work out whether it applies to them. Most will not.',
  },
  no_differentiation: {
    title: 'Say what you do that the alternatives do not',
    rationale:
      '{pages} pages claim to be good without naming a difference. Every competitor makes the same claim, so it distinguishes nothing.',
  },
  no_structured_formats: {
    title: 'Break the walls of prose into liftable pieces',
    rationale:
      '{pages} pages are unbroken prose with no list or table. The answer is in there; nothing marks where.',
  },
  passages_too_long: {
    title: 'Shorten the paragraphs carrying your answers',
    rationale:
      'On {pages} pages the paragraphs are too long to quote whole, so an answering system has to cut them and usually cuts badly.',
  },
  question_raised_unanswered: {
    title: 'Finish the questions your pages start',
    rationale:
      '{pages} pages raise a buyer question and leave it open. Raising it and not answering is worse than silence: the reader now has the question and no way to resolve it here.',
  },
}

/**
 * Site-level findings are already about the site, so they become opportunities directly
 * — reworded from what is wrong to what to do.
 */
const SITE_LEVEL: Record<string, { title: string; rationale: string }> = {
  journey_stage_missing: {
    title: 'Write for the buying stage you have skipped',
    rationale:
      'No page serves one of the stages a buyer passes through, so people arrive at that point and find nothing of yours.',
  },
  journey_concentrated: {
    title: 'Spread content across the buying decision',
    rationale:
      'Almost everything sits at one stage. The rest of the decision happens somewhere else, on somebody else’s pages.',
  },
  audience_drifts: {
    title: 'Settle who the site is talking to',
    rationale:
      'The audience shifts between pages without any page acknowledging it, so no single reader feels addressed throughout.',
  },
  audience_none_evident: {
    title: 'Decide who the site is for, and say so',
    rationale:
      'No audience is identifiable from these pages at all. Everything else is harder to judge until this is settled.',
  },
  audience_rarely_named: {
    title: 'Name the reader on the pages that sell',
    rationale:
      'Most pages never say who they are for. One sentence near the top of each is enough.',
  },
  pages_compete: {
    title: 'Consolidate the pages competing with each other',
    rationale:
      'Two pages cover the same ground at the same buying stage. They split whatever attention the subject earns, and neither becomes the obvious answer.',
  },
  site_sells_without_explaining: {
    title: 'Write something for people who have not decided yet',
    rationale:
      'The site sells and never explains. People search for their problem long before they search for a product, and those are the searches assistants answer most.',
  },
  site_has_no_next_step: {
    title: 'Give each page somewhere to go',
    rationale:
      'Most pages offer no next step, so anyone convinced by one has to invent their own way forward.',
  },
  question_unanswered_sitewide: {
    title: 'Answer the questions the site keeps raising',
    rationale:
      'A question comes up across the site and is settled nowhere. Someone comparing options has to ask you directly, or assume the worst.',
  },
}

/** Copy for a cluster of unanswered questions in one area of the question bank. */
const AREA_TITLE: Record<CoverageArea, string> = {
  understanding: 'Explain plainly what this is',
  pricing: 'Publish what it costs',
  suitability: 'Say who this suits, and who it does not',
  use_cases: 'Show what people actually do with it',
  implementation: 'Describe what getting started involves',
  comparison: 'Say how you differ from the alternatives',
  trust: 'Show who trusts you, and who you are',
  security: 'Say what happens to customer data',
  support: 'Describe the help people get when something breaks',
  purchase: 'Set out what happens when someone commits',
}

const fill = (text: string, pages: number) => text.replace('{pages}', String(pages))
const uniquePages = (findings: Finding[]) => [
  ...new Set(findings.flatMap((f) => f.affects.map((a) => a.pageUrl))),
]

/**
 * Group findings into pieces of work.
 *
 * `pageCount` is how many pages the findings came from; it decides whether "the same
 * check on several pages" can mean anything at all.
 */
export function buildOpportunities(findings: Finding[], pageCount: number): Opportunity[] {
  const out: Opportunity[] = []
  const byCheck = new Map<string, Finding[]>()
  for (const f of findings) {
    const list = byCheck.get(f.checkId)
    if (list) list.push(f)
    else byCheck.set(f.checkId, [f])
  }

  // 1. The same check across several pages is one job. Two occurrences is a coincidence.
  for (const [checkId, group] of byCheck) {
    const copy = RECURRING[checkId]
    if (!copy) continue
    const pages = uniquePages(group)
    if (pages.length < Math.min(SYSTEMIC_PAGES, Math.max(pageCount, 1))) continue
    out.push({
      id: `recurring:${checkId}`,
      title: copy.title,
      rationale: fill(copy.rationale, pages.length),
      fromFindings: group.map((f) => f.id),
      pages,
      tier: impactTier(checkId),
    })
  }

  // 2. A site-level finding is already a piece of work about the site.
  for (const [checkId, group] of byCheck) {
    const copy = SITE_LEVEL[checkId]
    if (!copy) continue
    for (const f of group) {
      out.push({
        id: `site:${f.id}`,
        title: copy.title,
        rationale: copy.rationale,
        fromFindings: [f.id],
        pages: f.affects.map((a) => a.pageUrl),
        tier: impactTier(checkId),
      })
    }
  }

  // 3. Unanswered questions in one area are one gap, not a checklist.
  const byArea = new Map<CoverageArea, Finding[]>()
  for (const f of findings) {
    if (f.module !== 'question_coverage') continue
    const bank = COVERAGE_LOOKUP[f.id.split(':')[1] ?? '']
    if (!bank) continue
    const list = byArea.get(bank.area)
    if (list) list.push(f)
    else byArea.set(bank.area, [f])
  }
  for (const [area, group] of byArea) {
    if (group.length < 2) continue // one unanswered question is not yet a subject
    const ids = new Set(group.map((f) => f.id))
    // Fold the per-check entries this replaces, so the plan says one thing once.
    for (let i = out.length - 1; i >= 0; i--) {
      const kept = out[i]!.fromFindings.filter((id) => !ids.has(id))
      if (kept.length === out[i]!.fromFindings.length) continue
      if (kept.length === 0) out.splice(i, 1)
      else out[i] = { ...out[i]!, fromFindings: kept }
    }
    out.push({
      id: `area:${area}`,
      title: AREA_TITLE[area],
      rationale: `${group.length} of the questions buyers ask about ${COVERAGE_AREAS[area].toLowerCase()} go unanswered here. Together they are one missing subject rather than ${group.length} separate edits.`,
      fromFindings: group.map((f) => f.id),
      pages: uniquePages(group),
      tier: impactTier(group[0]!.checkId),
    })
  }

  return out
    .sort(
      (a, b) =>
        a.tier - b.tier || b.pages.length - a.pages.length || a.id.localeCompare(b.id),
    )
    .slice(0, MAX_OPPORTUNITIES)
}
