import type { StaticTemplate } from '../structure/templates'

/**
 * Module 2 finding copy. Same rules as module 1: templates with slots, plain English,
 * and advice someone can act on this afternoon.
 */
export const EVIDENCE_TEMPLATES: Record<string, StaticTemplate> = {
  claim_without_evidence: {
    priority: 'medium',
    pageLevel: false,
    observation: 'A claim about {what} here has nothing to back it up.',
    whyItMatters:
      'The page asserts {what} but gives no number, source or example anywhere near it. A reader cannot check it, and an AI tool has no fact to quote — so the claim adds length without adding trust.',
    recommendedAction:
      'Add one concrete detail beside this claim: a figure, a named customer, a link to a case study, or the conditions it was measured under.',
  },
  evidence_irrelevant: {
    priority: 'medium',
    pageLevel: false,
    observation: 'The detail next to a claim about {what} does not actually support it.',
    whyItMatters:
      'There is a real fact beside this claim, which makes the page look evidenced when it is not. A reader who checks will find the number answers a different question — and that costs more trust than having no number at all.',
    recommendedAction:
      'Replace it with something that speaks to {what} directly, or move this claim next to proof that does.',
  },
  evidence_too_far: {
    priority: 'low',
    pageLevel: false,
    observation: 'The proof for a claim about {what} sits {distance} paragraphs away.',
    whyItMatters:
      'The evidence exists but not beside the claim. AI tools quote a passage at a time, so the claim gets lifted without its support and reads as an empty boast.',
    recommendedAction:
      'Move {evidence} into the same paragraph as the claim, or repeat it there.',
  },
}
