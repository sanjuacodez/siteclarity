import { describe, it, expect } from 'vitest'
import { extract } from '../../src/extract/extract'
import { makeEvidence, verifyEvidence, verifyAll } from '../../src/assemble/verify'
import { assembleFindings, type DecisionSource } from '../../src/assemble/findings'

/**
 * SC-110 — proof, not assertion.
 *
 * Invariant 1 says evidence is never model-authored. Jev cannot emit prose, so the risk
 * is largely structural — but "largely" is not "provably", and this is the product's
 * central promise. These tests construct fabricated evidence deliberately and require
 * that it be dropped.
 *
 * If any of these ever fails, the product's core claim is false. Do not weaken them.
 */

const HTML = `<!doctype html><html lang="en"><head><title>Pricing</title></head><body>
  <h1>Pricing</h1>
  <p>The plugin costs 49 dollars per year and covers five sites.</p>
  <p>Support is included for twelve months from purchase.</p>
</body></html>`

const doc = () => extract(HTML, 'https://e.com/pricing')

describe('quote verification gate', () => {
  it('accepts a quote taken verbatim from a stored passage', async () => {
    const d = await doc()
    const p = d.passages[0]!
    const ev = makeEvidence(d, p.id)!
    expect(verifyEvidence(d, ev)).toBe(true)
  })

  it('REJECTS a fabricated quote that was never on the page', async () => {
    const d = await doc()
    const p = d.passages[0]!
    const fabricated = {
      passageId: p.id,
      quote: 'The plugin costs 29 dollars per year and covers ten sites.',
    }
    expect(verifyEvidence(d, fabricated), 'fabricated evidence was accepted').toBe(false)
  })

  it('REJECTS a quote altered by a single word', async () => {
    const d = await doc()
    const p = d.passages[0]!
    const altered = { passageId: p.id, quote: p.text.replace('49', '99') }
    expect(verifyEvidence(d, altered), 'a one-word alteration slipped through').toBe(false)
  })

  it('REJECTS a plausible sentence stitched from two different passages', async () => {
    const d = await doc()
    const [a, b] = d.passages
    const stitched = {
      passageId: a!.id,
      quote: `${a!.text.split('.')[0]}. ${b!.text.split('.')[0]}.`,
    }
    expect(verifyEvidence(d, stitched), 'stitched evidence was accepted').toBe(false)
  })

  it('REJECTS a reference to a passage id that does not exist', async () => {
    const d = await doc()
    expect(verifyEvidence(d, { passageId: 's9:p9:deadbeef', quote: 'anything' })).toBe(false)
    expect(makeEvidence(d, 's9:p9:deadbeef')).toBeNull()
  })

  it('drops only the bad entries from a mixed batch', async () => {
    const d = await doc()
    const good = makeEvidence(d, d.passages[0]!.id)!
    const bad = { passageId: d.passages[0]!.id, quote: 'Invented text.' }
    expect(verifyAll(d, [good, bad, good])).toHaveLength(2)
  })

  it('tolerates whitespace and NFC differences only', async () => {
    const d = await doc()
    const p = d.passages[0]!
    expect(verifyEvidence(d, { passageId: p.id, quote: p.text.replace(/ /g, '  ') })).toBe(true)
    expect(verifyEvidence(d, { passageId: p.id, quote: p.text.normalize('NFD') })).toBe(true)
    // ...but not a semantic change hidden as punctuation.
    expect(verifyEvidence(d, { passageId: p.id, quote: p.text.replace('49', '4 9') })).toBe(false)
  })

  it('a finding whose evidence cannot be verified is never emitted', async () => {
    const d = await doc()
    // A source pointing at a passage id that does not exist in this document.
    const source: DecisionSource = {
      scope: 'section',
      refId: 's1',
      label: 'Pricing',
      heading: 'Pricing',
      passageIds: ['s1:p0:ffffffff'],
      decisions: {
        promotional_intensity: { kind: 'score', value: 4, confidence: 0.99 },
      },
    }
    const findings = assembleFindings(d, [source], 'https://e.com/pricing')
    expect(findings, 'a finding was emitted with unverifiable evidence').toHaveLength(0)
  })

  it('every emitted finding carries at least one verified quote', async () => {
    const d = await doc()
    const source: DecisionSource = {
      scope: 'section',
      refId: d.sections[0]!.id,
      label: 'Pricing',
      heading: 'Pricing',
      passageIds: d.sections[0]!.passageIds,
      decisions: {
        promotional_intensity: { kind: 'score', value: 4, confidence: 0.99 },
      },
    }
    for (const f of assembleFindings(d, [source], 'https://e.com/pricing')) {
      expect(f.evidence.length).toBeGreaterThan(0)
      for (const e of f.evidence) expect(verifyEvidence(d, e)).toBe(true)
    }
  })
})
