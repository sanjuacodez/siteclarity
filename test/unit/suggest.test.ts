import { describe, it, expect } from 'vitest'
import { findHypeTerms, hypeDensity } from '../../src/static/lexicons/hype'
import { suggestForPromotional } from '../../src/assemble/suggest'

describe('hype lexicon', () => {
  it('finds terms in page order, longest match wins', () => {
    const terms = findHypeTerms('We build world-class plugins with the best support.')
    expect(terms.map((t) => t.term)).toContain('world-class')
    expect(terms.map((t) => t.term)).toContain('best')
  })

  it('does not match inside other words', () => {
    // "bestow" and "easygoing" must not trigger "best" / "easy".
    expect(findHypeTerms('We bestow easygoing topiary.').map((t) => t.term)).toEqual([])
  })

  it('reports zero density for plain text', () => {
    expect(hypeDensity('The plugin adds a checkout field. It costs 49 dollars.')).toBe(0)
  })
})

describe('suggestions', () => {
  it('names the actual words found on the page', () => {
    const s = suggestForPromotional('We build world-class plugins and offer the best support.', {
      kind: 'choice', value: 'add_a_number', confidence: 0.9,
    })
    expect(s).toContain('world-class')
    expect(s).toContain('best')
    expect(s).toContain('figure')
  })

  it('renders a different fix when the model chooses one', () => {
    const text = 'Our seamless platform is incredible.'
    const a = suggestForPromotional(text, { kind: 'choice', value: 'add_a_number', confidence: 0.9 })
    const b = suggestForPromotional(text, { kind: 'choice', value: 'cite_evidence', confidence: 0.9 })
    expect(a).not.toBe(b)
    expect(b).toContain('proof')
  })

  it('falls back cleanly when no hype term is present', () => {
    const s = suggestForPromotional('The plugin adds a field.', undefined)
    expect(s).toBeTruthy()
    expect(s).not.toContain('leans on')
  })
})
