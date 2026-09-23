import type { StaticTemplate } from '../structure/templates'

/** Findings from the model-judged messaging dimensions. */
export const MESSAGING_JUDGED: Record<string, StaticTemplate> = {
  no_problem_stated: {
    priority: 'high',
    pageLevel: true,
    observation: 'The page describes what it offers but never says what problem it solves.',
    whyItMatters:
      'A reader arrives with a problem, not a shopping list. Without naming the situation this exists to fix, they have to work out for themselves whether it applies to them — and most will not bother.',
    recommendedAction:
      'Open with the problem in one sentence: what goes wrong today for the person you are writing for.',
  },
  audience_not_named: {
    priority: 'medium',
    pageLevel: true,
    observation: 'The page never says who it is for.',
    whyItMatters:
      'Writing for "teams" or "businesses" means writing for nobody. A reader cannot tell whether they qualify, and search and AI systems cannot match the page to a specific kind of person looking for it.',
    recommendedAction:
      'Name the reader plainly — the role, the size of business, the situation. "For WooCommerce stores with more than 500 products" beats "for growing businesses".',
  },
  no_differentiation: {
    priority: 'medium',
    pageLevel: true,
    observation: 'The page says it is good, but not what makes it different.',
    whyItMatters:
      'Every competitor claims to be powerful and easy, so those words carry no information. Without a specific difference — something it does that others do not, or a trade-off it chose — a reader has no basis for picking this.',
    recommendedAction:
      'State one concrete difference, and be willing to name the trade-off that comes with it.',
  },
}

export const MESSAGING_TEMPLATES: Record<string, StaticTemplate> = {
  vague_cta: {
    priority: 'medium',
    pageLevel: true,
    observation: '{count} link(s) on this page say nothing about where they go — {examples}.',
    whyItMatters:
      '"Click here" and "read more" tell a reader nothing, so fewer people follow them. They also give search engines no idea what the destination is about, which wastes the link.',
    recommendedAction:
      'Rewrite the link text to name the destination: "read the pricing guide" instead of "read more".',
  },
  no_clear_action: {
    priority: 'medium',
    pageLevel: true,
    observation: 'This page has links but none of them offer an obvious next step.',
    whyItMatters:
      'A reader who is convinced has nowhere to go. Every link here is navigation or reading; none invites them to start, try, book or get in touch.',
    recommendedAction:
      'Add one clear action that names what happens — "Start a free trial", "Book a 20-minute call", "Download the guide".',
  },
}
