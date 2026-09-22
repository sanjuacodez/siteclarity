/**
 * SC-107 — the hype lexicon.
 *
 * A committed, reviewed word list rather than anything model-generated, so results are
 * reproducible and reviewable. Grouped by what the word is doing, because the group
 * determines what the useful replacement is.
 *
 * This is the first piece of the deterministic layer: it needs no model, and it is what
 * lets a suggestion name the ACTUAL words on the page instead of saying "each superlative".
 */
export const HYPE_TERMS: Record<string, string[]> = {
  // Claims of rank that invite "compared with what, measured how?"
  superiority: [
    'best', 'best-in-class', 'best in class', 'world-class', 'world class', 'leading',
    'market-leading', 'number one', '#1', 'top', 'premier', 'unmatched', 'unrivalled',
    'unrivaled', 'unbeatable', 'superior', 'ultimate', 'finest', 'greatest',
  ],
  // Scale words standing in for a figure.
  magnitude: [
    'massive', 'huge', 'enormous', 'dramatic', 'dramatically', 'significantly',
    'substantially', 'exponentially', 'countless', 'endless', 'unlimited', 'infinite',
    'tons of', 'a ton of', 'lots of',
  ],
  // Novelty words with a short shelf life and no content.
  novelty: [
    'revolutionary', 'game-changing', 'game changing', 'cutting-edge', 'cutting edge',
    'state-of-the-art', 'state of the art', 'next-generation', 'next generation',
    'groundbreaking', 'innovative', 'disruptive', 'bleeding-edge',
  ],
  // Effortlessness claims that usually hide a real constraint.
  ease: [
    'seamless', 'seamlessly', 'effortless', 'effortlessly', 'hassle-free', 'painless',
    'simply', 'just', 'easy', 'easily', 'instantly', 'in seconds', 'one click',
    'one-click', 'no time',
  ],
  // Quality adjectives that assert rather than demonstrate.
  quality: [
    'amazing', 'awesome', 'incredible', 'exceptional', 'outstanding', 'fantastic',
    'excellent', 'perfect', 'stunning', 'beautiful', 'powerful', 'robust',
    'comprehensive', 'feature-rich', 'cutting', 'flawless', 'premium',
  ],
}

const ALL = Object.entries(HYPE_TERMS).flatMap(([group, terms]) =>
  terms.map((t) => ({ group, term: t })),
)

// Longest first so "best-in-class" wins over "best".
const SORTED = [...ALL].sort((a, b) => b.term.length - a.term.length)

export interface HypeMatch {
  term: string
  group: string
}

/** Terms actually present, in page order, de-duplicated. */
export function findHypeTerms(text: string, limit = 6): HypeMatch[] {
  const lower = text.toLowerCase()
  const seen = new Set<string>()
  const out: { match: HypeMatch; at: number }[] = []

  for (const { group, term } of SORTED) {
    if (seen.has(term)) continue
    const pattern = new RegExp(`(?<![\\p{L}-])${escapeRe(term)}(?![\\p{L}-])`, 'u')
    const at = lower.search(pattern)
    if (at === -1) continue
    // Skip a shorter term already covered by a longer match at the same spot.
    if (out.some((o) => Math.abs(o.at - at) < 2)) continue
    seen.add(term)
    out.push({ match: { term, group }, at })
  }

  return out.sort((a, b) => a.at - b.at).slice(0, limit).map((o) => o.match)
}

export function hypeDensity(text: string): number {
  const words = text.split(/\s+/).filter(Boolean).length
  if (words === 0) return 0
  return (findHypeTerms(text, 100).length / words) * 100
}

function escapeRe(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
