import { describe, it, expect } from 'vitest'
import acowebs from '../fixtures/html/acowebs-home.html?raw'
import { extract } from '../../src/extract/extract'
import { detectTestimonialSections } from '../../src/semantic/state'

describe('review detection', () => {
  it('excludes testimonials without excluding marketing copy', async () => {
    const doc = await extract(acowebs, 'https://acowebs.com/')
    const skip = detectTestimonialSections(doc)
    const withText = doc.sections.filter((s) => s.passageIds.length > 0)
    const kept = withText.filter((s) => !skip.has(s.id))

    console.log(`\n  detected as review : ${skip.size}`)
    console.log(`  kept for analysis  : ${kept.length}`)
    console.log('\n  KEPT (should be marketing/product copy only):')
    kept.slice(0, 12).forEach((s) =>
      console.log(`    ${(s.heading ?? '(none)').slice(0, 50)}`))

    // The known leakers must now be excluded.
    for (const name of ['Armando', 'redwheaton', 'jodiebradshaw', 'Oliver']) {
      const sec = withText.find((s) => (s.heading ?? '').includes(name))
      if (sec) expect(skip.has(sec.id), `${name} should be excluded`).toBe(true)
    }
    // Genuine marketing copy must survive.
    for (const name of ['award-winning', 'Affordable']) {
      const sec = withText.find((s) => (s.heading ?? '').includes(name))
      if (sec) expect(skip.has(sec.id), `${name} should be KEPT`).toBe(false)
    }
  })
})
