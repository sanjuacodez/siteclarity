import { describe, it, expect } from 'vitest'
import acowebs from '../fixtures/html/acowebs-home.html?raw'
import cloudflare from '../fixtures/html/cloudflare-workers-ai.html?raw'
import { extract } from '../../src/extract/extract'
import {
  buildPageState,
  buildSectionStates,
  buildPassageStates,
  selectClaimCandidates,
} from '../../src/semantic/state'

const FIXTURES = [
  { name: 'acowebs-home', html: acowebs, url: 'https://acowebs.com/' },
  { name: 'cloudflare-workers-ai', html: cloudflare, url: 'https://www.cloudflare.com/' },
]

describe('extraction + scoped state', () => {
  for (const f of FIXTURES) {
    it(`${f.name}: extracts and fits the state budget`, async () => {
      const t0 = Date.now()
      const doc = await extract(f.html, f.url)
      const extractMs = Date.now() - t0

      const page = buildPageState(doc, f.url)
      const sections = buildSectionStates(doc, 6000)
      const claims = selectClaimCandidates(doc)
      const passages = buildPassageStates(doc, claims)

      const maxSection = Math.max(0, ...sections.map((s) => s.estimatedTokens))
      const maxPassage = Math.max(0, ...passages.map((s) => s.estimatedTokens))
      const total =
        page.estimatedTokens +
        sections.reduce((n, s) => n + s.estimatedTokens, 0) +
        passages.reduce((n, s) => n + s.estimatedTokens, 0)

      console.log(
        `\n${f.name}\n` +
          `  html            ${(f.html.length / 1024).toFixed(0)} KB\n` +
          `  extract         ${extractMs} ms\n` +
          `  sections        ${doc.sections.length}\n` +
          `  passages        ${doc.passages.length}\n` +
          `  links           ${doc.links.length}\n` +
          `  jsonLd blocks   ${doc.jsonLdRaw.length}\n` +
          `  lang            ${doc.lang}\n` +
          `  js-dependent    ${doc.jsDependency.likely}\n` +
          `  --- state ---\n` +
          `  page state      ${page.estimatedTokens} tok\n` +
          `  section states  ${sections.length} (max ${maxSection} tok)\n` +
          `  claim states    ${passages.length} (max ${maxPassage} tok)\n` +
          `  calls needed    ${1 + sections.length + passages.length}\n` +
          `  total tokens    ${total} (vs ${total} in ONE 32k state = ${total > 32000 ? 'OVERFLOW' : 'would fit'})`,
      )

      // Every individual state must fit well inside the 32k context.
      expect(page.estimatedTokens).toBeLessThan(32000)
      expect(maxSection).toBeLessThan(32000)
      expect(maxPassage).toBeLessThan(32000)
      expect(doc.passages.length).toBeGreaterThan(0)
    })

    it(`${f.name}: passage IDs are stable across runs`, async () => {
      const a = await extract(f.html, f.url)
      const b = await extract(f.html, f.url)
      expect(a.passages.map((p) => p.id)).toEqual(b.passages.map((p) => p.id))
    })

    it(`${f.name}: every passage text is recoverable by ID`, async () => {
      const doc = await extract(f.html, f.url)
      for (const p of doc.passages) {
        expect(doc.passagesById.get(p.id)?.text).toBe(p.text)
      }
    })

    it(`${f.name}: section states contain no other section's text`, async () => {
      const doc = await extract(f.html, f.url)
      const states = buildSectionStates(doc, 6000)
      for (const s of states) {
        const section = (s.meta as { section: { id: string; passageIds: string[] } }).section
        const own = new Set(section.passageIds.map((id) => doc.passagesById.get(id)?.text))
        const text = String((s.state as { text: string }).text)
        for (const other of doc.passages) {
          if (own.has(other.text)) continue
          if (other.text.length < 60) continue
          expect(text.includes(other.text)).toBe(false)
        }
      }
    })
  }
})
