import { describe, it, expect } from 'vitest'
import acowebs from '../fixtures/html/acowebs-home.html?raw'
import cloudflare from '../fixtures/html/cloudflare-workers-ai.html?raw'
import aiSearch from '../fixtures/html/sanjayshankar-ai-search.html?raw'
import home from '../fixtures/html/sanjayshankar-home.html?raw'
import { extract } from '../../src/extract/extract'
import { assembleStaticFindings, assembleFindings, type DecisionSource } from '../../src/assemble/findings'
import { verifyEvidence } from '../../src/assemble/verify'
import { assertNoOverallScore } from '../../src/contracts'
import { TEMPLATE_GROUPS } from '../../src/checks/registry'
import { CHECKS } from '../../src/assemble/checks'

/**
 * The anti-fabrication suite.
 *
 * The product's whole position is that it cannot invent anything. That claim is only
 * worth making if it is enforced, so this asserts every part of it across the real
 * fixture corpus rather than on a contrived example:
 *
 *   1. every quote is verbatim page text
 *   2. no template slot ever reaches a reader unfilled
 *   3. all copy is template-sourced, never model-authored
 *   4. no overall score appears anywhere
 *   5. no finding claims a passage or page that does not exist
 *
 * If any of these fail, the product is lying to someone.
 */
const FIXTURES: [string, string, string][] = [
  ['acowebs', acowebs, 'https://acowebs.com/'],
  ['cloudflare', cloudflare, 'https://www.cloudflare.com/'],
  ['article', aiSearch, 'https://sanjayshankar.me/x'],
  ['home', home, 'https://sanjayshankar.me/'],
]

/** A decision source for every section, with every answer maximally damning. */
function hostileSources(doc: Awaited<ReturnType<typeof extract>>): DecisionSource[] {
  return doc.sections
    .filter((s) => s.passageIds.length > 0)
    .map((s) => ({
      scope: 'section' as const,
      refId: s.id,
      label: s.heading ?? '',
      heading: s.heading,
      passageIds: s.passageIds,
      decisions: {
        answers_heading: { kind: 'noul' as const, value: 0, confidence: 1 },
        self_contained: { kind: 'noul' as const, value: 0, confidence: 1 },
        extraction_readiness: { kind: 'choice' as const, value: 'absent', confidence: 1 },
        promotional_intensity: { kind: 'score' as const, value: 4, confidence: 1 },
        improvement_type: { kind: 'choice' as const, value: 'add_a_number', confidence: 1 },
      },
    }))
}

describe('nothing is fabricated, across the whole fixture corpus', () => {
  for (const [name, html, url] of FIXTURES) {
    it(`${name}: every quote is verbatim page text`, async () => {
      const doc = await extract(html, url)
      const findings = [
        ...assembleStaticFindings(doc, url),
        ...assembleFindings(doc, hostileSources(doc), url),
      ]
      expect(findings.length, 'no findings produced — this test would pass vacuously').toBeGreaterThan(0)

      for (const f of findings) {
        for (const e of f.evidence) {
          expect(verifyEvidence(doc, e), `${f.checkId}: quote not found in its passage`).toBe(true)
          // And the passage it names must actually exist.
          expect(doc.passagesById.has(e.passageId), `${f.checkId}: unknown passage`).toBe(true)
        }
      }
    })

    it(`${name}: no template slot reaches a reader unfilled`, async () => {
      const doc = await extract(html, url)
      const findings = [
        ...assembleStaticFindings(doc, url),
        ...assembleFindings(doc, hostileSources(doc), url),
      ]
      for (const f of findings) {
        for (const field of ['observation', 'whyItMatters', 'recommendedAction'] as const) {
          expect(f[field], `${f.checkId}.${field} has an unfilled slot`).not.toMatch(/\{\w+\}/)
          expect(f[field].trim().length, `${f.checkId}.${field} is empty`).toBeGreaterThan(0)
          // "undefined" or "NaN" in prose means a slot was filled from nothing.
          expect(f[field], `${f.checkId}.${field} leaked a bad value`).not.toMatch(/\bundefined\b|\bNaN\b|\[object Object\]/)
        }
      }
    })

    it(`${name}: all copy is template-sourced and no score is emitted`, async () => {
      const doc = await extract(html, url)
      const findings = [
        ...assembleStaticFindings(doc, url),
        ...assembleFindings(doc, hostileSources(doc), url),
      ]
      for (const f of findings) {
        expect(f.copySource, `${f.checkId} is not template-sourced`).toBe('template')
        expect(f.affects.length, `${f.checkId} affects nothing`).toBeGreaterThan(0)
        for (const a of f.affects) expect(a.pageUrl).toBe(url)
      }
      assertNoOverallScore({ findings })
    })

    it(`${name}: every highlighted word is visible to the reader`, async () => {
      const doc = await extract(html, url)
      const findings = [
        ...assembleStaticFindings(doc, url),
        ...assembleFindings(doc, hostileSources(doc), url),
      ]
      for (const f of findings) {
        if (f.highlights.length === 0) continue
        // A highlight has to be findable in what the reader is actually shown. Usually
        // that is the quote; for a page-level finding with no passage to quote, the
        // observation lists the words instead. Either is honest — naming a word that
        // appears in neither is not, because the reader is told to look for something
        // that is not in front of them.
        const visible = [...f.evidence.map((e) => e.quote), f.observation]
          .join(' ')
          .toLowerCase()
        for (const word of f.highlights) {
          expect(visible, `${f.checkId}: highlighted "${word}" is shown nowhere`)
            .toContain(word.toLowerCase())
        }
      }
    })
  }

  it('every finding a check can emit is declared in the registry', async () => {
    const declared = new Set([
      ...TEMPLATE_GROUPS.flatMap((g) => Object.keys(g.templates)),
      ...CHECKS.map((c) => c.id),
    ])
    const seen = new Set<string>()
    for (const [, html, url] of FIXTURES) {
      const doc = await extract(html, url)
      for (const f of [
        ...assembleStaticFindings(doc, url),
        ...assembleFindings(doc, hostileSources(doc), url),
      ]) {
        seen.add(f.checkId)
      }
    }
    // An emitted check that is not declared would appear in a report while being
    // absent from the documentation page.
    const undeclared = [...seen].filter((id) => !declared.has(id))
    expect(undeclared, `emitted but undeclared: ${undeclared.join(', ')}`).toEqual([])
    expect(seen.size, 'no checks fired — vacuous').toBeGreaterThan(3)
  })

  it('a deliberately fabricated quote is still rejected end to end', async () => {
    const doc = await extract(acowebs, 'https://acowebs.com/')
    const real = doc.passages[0]!
    expect(verifyEvidence(doc, { passageId: real.id, quote: 'Acme guarantees 99.99% uptime.' })).toBe(false)
    expect(verifyEvidence(doc, { passageId: 'nope:p0:00000000', quote: real.text })).toBe(false)
  })
})

describe('the README does not state numbers the code contradicts', () => {
  it('quotes the real page cap', async () => {
    // The README claimed a 300 KB cap after it had been lowered to 250 KB — a factual
    // claim about behaviour that had gone stale. Numbers in prose drift; this pins the
    // one that matters to the config.
    const readme = (await import('../../README.md?raw')).default as string
    const wrangler = (await import('../../wrangler.jsonc?raw')).default as string
    const configured = Number(/"MAX_PAGE_BYTES":\s*"(\d+)"/.exec(wrangler)?.[1] ?? 0)
    expect(configured).toBeGreaterThan(0)

    const stated = /\*\*(\d+) KB page cap\*\*/.exec(readme)?.[1]
    expect(stated, 'README no longer states a page cap').toBeTruthy()
    expect(Number(stated) * 1000).toBe(configured)
  })
})
