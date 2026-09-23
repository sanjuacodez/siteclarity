/**
 * Module 3 — Messaging Intelligence: the deterministic slice.
 *
 * Most messaging dimensions are judgements and belong to the model. Two are not:
 * whether the page offers a next step at all, and whether that step says what it does.
 * Both are visible in the link text, which is why the extractor now captures it.
 */
import type { ExtractedDoc } from '../../extract/extract'

/** Link text that tells the reader nothing about what happens next. */
const VAGUE_CTA = /^(click here|here|read more|more|learn more|find out more|see more|continue|go|submit|next|this|link|details)\.?$/i

/** Link text that names an action and an outcome. */
const ACTION_CTA =
  /\b(start|try|book|buy|get|download|install|sign ?up|subscribe|request|schedule|contact|talk|compare|calculate|estimate|see (?:pricing|plans|the demo))\b/i

/** Navigation rather than a call to action. */
const NAV_TEXT = /^(home|about|blog|docs?|documentation|pricing|contact|support|login|sign ?in|search|menu|privacy|terms)\.?$/i

export interface CtaAnalysis
{
  /** Links that read as a call to action. */
  actions: { href: string; text: string }[]
  /** Links whose text says nothing about what they do. */
  vague: { href: string; text: string }[]
  /** True when the page offers no discernible next step. */
  noAction: boolean
}

export function analyseCtas(doc: ExtractedDoc): CtaAnalysis {
  const actions: CtaAnalysis['actions'] = []
  const vague: CtaAnalysis['vague'] = []
  const seen = new Set<string>()

  for (const link of doc.links) {
    const text = link.text.trim()
    if (!text || text.length > 60) continue
    if (NAV_TEXT.test(text)) continue

    const key = `${text.toLowerCase()}|${link.href}`
    if (seen.has(key)) continue
    seen.add(key)

    if (VAGUE_CTA.test(text)) vague.push({ href: link.href, text })
    else if (ACTION_CTA.test(text)) actions.push({ href: link.href, text })
  }

  // Only claim there is no next step when the page had links to judge. A page with no
  // links at all is a different problem, and not this check's business.
  const hadCandidates = doc.links.some((l) => l.text.trim() && !NAV_TEXT.test(l.text.trim()))
  return { actions, vague, noAction: hadCandidates && actions.length === 0 }
}
