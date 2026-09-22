import { describe, it, expect } from 'vitest'
import { extract } from '../../src/extract/extract'
import { runStaticChecks } from '../../src/static/structure/checks'
import { STATIC_TEMPLATES } from '../../src/static/structure/templates'
import { assembleStaticFindings } from '../../src/assemble/findings'

const page = (body: string, head = '') =>
  `<!doctype html><html lang="en"><head><title>A reasonably specific page title</title>
   <meta name="description" content="x"><link rel="canonical" href="https://e.com/p">
   ${head}</head><body>${body}</body></html>`

describe('SC-106 deterministic checks', () => {
  it('every check id has a template', async () => {
    const doc = await extract(page('<h1>A</h1><h4>Skipped</h4><p>short</p>'), 'https://e.com/p')
    for (const r of runStaticChecks(doc, 'https://e.com/p')) {
      expect(STATIC_TEMPLATES[r.checkId], `no template for ${r.checkId}`).toBeTruthy()
    }
  })

  it('flags a missing H1 and a skipped level', async () => {
    const doc = await extract(page('<h2>Only</h2><h4>Skip</h4><p>text here</p>'), 'https://e.com/p')
    const ids = runStaticChecks(doc, 'https://e.com/p').map((r) => r.checkId)
    expect(ids).toContain('no_h1')
    expect(ids).toContain('skipped_heading_levels')
  })

  it('does not flag a well-formed heading tree', async () => {
    const doc = await extract(page('<h1>A</h1><h2>B</h2><h3>C</h3><p>text</p>'), 'https://e.com/p')
    const ids = runStaticChecks(doc, 'https://e.com/p').map((r) => r.checkId)
    expect(ids).not.toContain('no_h1')
    expect(ids).not.toContain('skipped_heading_levels')
    expect(ids).not.toContain('multiple_h1')
  })

  it('reports malformed JSON-LD rather than throwing', async () => {
    const doc = await extract(
      page('<h1>A</h1><p>t</p>', '<script type="application/ld+json">{bad json,}</script>'),
      'https://e.com/p',
    )
    expect(runStaticChecks(doc, 'https://e.com/p').map((r) => r.checkId))
      .toContain('malformed_structured_data')
  })

  it('accepts valid JSON-LD', async () => {
    const doc = await extract(
      page('<h1>A</h1><p>t</p>',
        '<script type="application/ld+json">{"@type":"Article","name":"x"}</script>'),
      'https://e.com/p',
    )
    const ids = runStaticChecks(doc, 'https://e.com/p').map((r) => r.checkId)
    expect(ids).not.toContain('malformed_structured_data')
    expect(ids).not.toContain('no_structured_data')
  })

  it('flags noindex and an off-site canonical', async () => {
    const doc = await extract(
      page('<h1>A</h1><p>t</p>',
        '<meta name="robots" content="noindex"><link rel="canonical" href="https://other.com/x">'),
      'https://e.com/p',
    )
    const ids = runStaticChecks(doc, 'https://e.com/p').map((r) => r.checkId)
    expect(ids).toContain('meta_noindex')
    expect(ids).toContain('canonical_offsite')
  })

  it('produces findings with no decision model at all', async () => {
    const doc = await extract(page('<h2>No H1</h2><p>' + 'word '.repeat(10) + '</p>'), 'https://e.com/p')
    const findings = assembleStaticFindings(doc, 'https://e.com/p')
    expect(findings.length).toBeGreaterThan(0)
    for (const f of findings) {
      expect(f.observation).not.toMatch(/\{\w+\}/)       // every slot filled
      expect(f.recommendedAction).not.toMatch(/\{\w+\}/)
      expect(f.confidence).toBe('high')
    }
  })
})
