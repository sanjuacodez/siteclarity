import { describe, it, expect } from 'vitest'
import acowebs from '../fixtures/html/acowebs-home.html?raw'
import cloudflare from '../fixtures/html/cloudflare-workers-ai.html?raw'
import aiSearch from '../fixtures/html/sanjayshankar-ai-search.html?raw'
import home from '../fixtures/html/sanjayshankar-home.html?raw'
import { extract } from '../../src/extract/extract'
import { assembleStaticFindings } from '../../src/assemble/findings'
import { verifyEvidence } from '../../src/assemble/verify'
import { CORPUS } from './corpus'

const FIXTURES: Record<string, { html: string; url: string }> = {
  'acowebs-home': { html: acowebs, url: 'https://acowebs.com/' },
  'cloudflare-workers-ai': { html: cloudflare, url: 'https://www.cloudflare.com/' },
  'sanjayshankar-ai-search': {
    html: aiSearch,
    url: 'https://sanjayshankar.me/how-ai-search-engines-work-technical-guide/',
  },
  'sanjayshankar-home': { html: home, url: 'https://sanjayshankar.me/' },
}

describe('SC-113 calibration — deterministic layer', () => {
  for (const [name, exp] of Object.entries(CORPUS)) {
    const fx = FIXTURES[name]!

    it(`${name}: matches hand-labelled expectations`, async () => {
      const doc = await extract(fx.html, fx.url)
      const ids = assembleStaticFindings(doc, fx.url).map((f) => f.checkId)

      for (const want of exp.expect) {
        expect(ids, `MISSED "${want}" — ${exp.why[want] ?? ''}`).toContain(want)
      }
      for (const bad of exp.reject) {
        expect(ids, `FALSE POSITIVE "${bad}" — ${exp.why[bad] ?? ''}`).not.toContain(bad)
      }
    })
  }

  it('every finding across the corpus carries verified evidence or is page-level', async () => {
    for (const [name, fx] of Object.entries(FIXTURES)) {
      const doc = await extract(fx.html, fx.url)
      for (const f of assembleStaticFindings(doc, fx.url)) {
        for (const e of f.evidence) {
          expect(verifyEvidence(doc, e), `${name}: unverified quote in ${f.checkId}`).toBe(true)
        }
      }
    }
  })

  it('no template slot is left unfilled anywhere in the corpus', async () => {
    for (const [name, fx] of Object.entries(FIXTURES)) {
      const doc = await extract(fx.html, fx.url)
      for (const f of assembleStaticFindings(doc, fx.url)) {
        for (const field of ['observation', 'whyItMatters', 'recommendedAction'] as const) {
          expect(f[field], `${name}/${f.checkId}: unfilled slot in ${field}`).not.toMatch(/\{\w+\}/)
        }
      }
    }
  })

  it('is deterministic — the same fixture yields the same findings twice', async () => {
    for (const fx of Object.values(FIXTURES)) {
      const a = assembleStaticFindings(await extract(fx.html, fx.url), fx.url)
      const b = assembleStaticFindings(await extract(fx.html, fx.url), fx.url)
      expect(a.map((f) => f.id)).toEqual(b.map((f) => f.id))
    }
  })

  it('reports the current baseline for drift tracking', async () => {
    const rows: string[] = []
    for (const [name, fx] of Object.entries(FIXTURES)) {
      const doc = await extract(fx.html, fx.url)
      const findings = assembleStaticFindings(doc, fx.url)
      rows.push(
        `  ${name.padEnd(26)} ${String(doc.sections.length).padStart(3)} sections, ` +
        `${String(doc.passages.length).padStart(4)} passages, ` +
        `${String(findings.length).padStart(2)} static findings` +
        (findings.length ? `  [${findings.map((f) => f.checkId).join(', ')}]` : ''),
      )
    }
    console.log(`\n  CALIBRATION BASELINE\n${rows.join('\n')}`)
    expect(rows).toHaveLength(4)
  })
})
