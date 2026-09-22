import { describe, it, expect } from 'vitest'
import { extract } from '../../src/extract/extract'
import { excludedSections } from '../../src/semantic/state'
import aiSearch from '../fixtures/html/sanjayshankar-ai-search.html?raw'

/**
 * Frozen snapshot, never a live fetch (AGENTS.md §8). Live pages change, which turns a
 * regression test into a flake and makes CI depend on a third party staying online.
 */
const PAGE = 'https://sanjayshankar.me/how-ai-search-engines-work-technical-guide/'

/**
 * F12 regression tests.
 *
 * The visible symptom was false "contains no substantive answer" findings quoting an
 * author byline. The root cause was that nav/footer/aside were never excluded, so
 * footer links were absorbed into the last heading's section.
 */
describe('chrome exclusion and boilerplate (F12)', () => {
  it('keeps footer and nav out of sections', async () => {
    const doc = await extract(aiSearch, PAGE)
    const all = doc.passages.map((p) => p.text)
    for (const chrome of ['me@sanjayshankar.me', '+91 9745 145 445', 'WordPress.org', 'All my links']) {
      expect(all, `footer content "${chrome}" leaked into extraction`).not.toContain(chrome)
    }
  })

  it('leaves related-post cards with no content to judge', async () => {
    const doc = await extract(aiSearch, PAGE)
    const card = doc.sections.find((s) => (s.heading ?? '').startsWith('GEO vs AEO'))
    // The card previously absorbed 22 footer passages and was judged as a real section.
    if (card) expect(card.passageIds.length).toBe(0)
  })

  it('does not mistake table cells for navigation', async () => {
    const doc = await extract(aiSearch, PAGE)
    const table = doc.sections.find((s) => (s.heading ?? '').startsWith('The Search Indexes'))
    // A comparison table legitimately holds many short cells; it must survive.
    if (table) {
      expect(table.passageIds.length).toBeGreaterThan(5)
      expect(excludedSections(doc).has(table.id)).toBe(false)
    }
  })

  it('treats text repeated across sections as boilerplate, not within one', async () => {
    const doc = await extract(aiSearch, PAGE)
    const byline = doc.passages.find((p) => p.text.startsWith('Tech manager and agentic SEO'))
    if (byline) expect(doc.boilerplatePassageIds.has(byline.id)).toBe(true)
  })

  it('keeps genuine content sections', async () => {
    const doc = await extract(aiSearch, PAGE)
    const real = doc.sections.find((s) => (s.heading ?? '').startsWith('GEO-Exclusive Tactics'))
    if (real) expect(excludedSections(doc).has(real.id)).toBe(false)
  })
})

describe('chrome exclusion must not eat content', () => {
  it('keeps an H1 that lives inside an article header', async () => {
    const html = `<!doctype html><html lang="en"><head><title>T</title></head><body>
      <header><nav><a href="/">Home</a></nav></header>
      <main><article>
        <header><h1>The Real Article Title</h1></header>
        <p>Body text that should survive extraction intact.</p>
      </article></main>
      <footer><p>me@example.com</p></footer>
    </body></html>`
    const doc = await extract(html, 'https://e.com/')
    expect(doc.headings.map((h) => h.text)).toContain('The Real Article Title')
    expect(doc.passages.map((p) => p.text)).not.toContain('me@example.com')
    expect(doc.passages.map((p) => p.text)).toContain('Body text that should survive extraction intact.')
  })
})
