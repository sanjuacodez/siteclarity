import { describe, it, expect } from 'vitest'
import { classifyClaim, detectEvidence, findClaims } from '../../src/static/evidence/markers'
import { extract } from '../../src/extract/extract'
import { assembleStaticFindings } from '../../src/assemble/findings'

const page = (body: string) =>
  `<!doctype html><html lang="en"><head><title>Acme Checkout plugin</title></head><body>${body}</body></html>`

describe('Module 2 — claim detection', () => {
  it('recognises each claim family named in the brief', () => {
    expect(classifyClaim('Our plugin is dramatically faster than alternatives')?.kind).toBe('performance')
    expect(classifyClaim('Merchants boost conversion with our seamless flow')?.kind).toBe('outcome')
    expect(classifyClaim('The leading checkout plugin for WooCommerce')?.kind).toBe('leadership')
    expect(classifyClaim('Set up in minutes with no code at all')?.kind).toBe('ease')
    expect(classifyClaim('All data is encrypted and GDPR compliant')?.kind).toBe('security')
    expect(classifyClaim('Rock solid reliability with guaranteed uptime')?.kind).toBe('reliability')
  })

  it('does not treat neutral prose as a claim', () => {
    expect(classifyClaim('The settings screen lists every field you have created')).toBeNull()
  })
})

describe('Module 2 — evidence detection', () => {
  it('recognises figures, sources, docs, certifications and dates', () => {
    expect(detectEvidence('Setup takes 12 minutes on average')).toContain('figure')
    expect(detectEvidence('According to a 2026 survey of merchants')).toContain('source')
    expect(detectEvidence('See the case study for the full workflow')).toContain('documentation')
    expect(detectEvidence('We are SOC 2 audited')).toContain('named')
    expect(detectEvidence('Shipping since 2019 without incident')).toContain('timeframe')
  })

  it('finds nothing in a claim with no substance', () => {
    expect(detectEvidence('Simply the best and most seamless experience available')).toEqual([])
  })
})

describe('Module 2 — claims paired with their evidence', () => {
  const claims = async (body: string) => {
    const doc = await extract(page(body), 'https://e.com/p')
    return findClaims(doc, new Set())
  }

  it('flags a boast with nothing behind it', async () => {
    const c = await claims('<h2>Speed</h2><p>Acme Checkout is dramatically faster and more seamless than every alternative on the market today.</p>')
    expect(c).toHaveLength(1)
    expect(c[0]!.evidence).toEqual([])
    expect(c[0]!.distance).toBe(-1)
    expect(c[0]!.terms.length).toBeGreaterThan(0)
  })

  it('accepts a claim that carries its own proof', async () => {
    const c = await claims('<h2>Speed</h2><p>Acme Checkout renders the seamless checkout in 180 ms, measured across 1,000 runs.</p>')
    expect(c[0]!.evidence).toContain('figure')
    expect(c[0]!.distance).toBe(0)
  })

  it('notices when the proof sits in a neighbouring paragraph', async () => {
    const c = await claims(
      '<h2>Speed</h2><p>Acme Checkout is dramatically faster and more seamless than the alternatives available.</p>' +
      '<p>Rendering completes in 180 ms on a four-core server.</p>',
    )
    expect(c[0]!.distance).toBe(1)
    expect(c[0]!.supportId).toBeTruthy()
  })

  it('needs both a hype word and a claim family, not either alone', async () => {
    // A claim word in neutral prose is not a boast.
    expect(await claims('<h2>Speed</h2><p>The plugin reduces the number of checkout fields shown to returning buyers.</p>')).toHaveLength(0)
    // Hype with nothing checkable asserted is module 1 territory, not module 2.
    expect(await claims('<h2>About</h2><p>We are a world-class team of people who care deeply about our craft.</p>')).toHaveLength(0)
  })

  it('ignores passages too short to be auditing', async () => {
    expect(await claims('<h2>Speed</h2><p>Blazing fast.</p>')).toHaveLength(0)
  })
})

describe('Module 2 — reaches the report', () => {
  it('emits a finding attributed to the evidence module', async () => {
    const doc = await extract(page('<h1>Acme</h1><h2>Performance</h2><p>Acme Checkout is dramatically faster and more seamless than every competing plugin available.</p>'), 'https://e.com/p')
    const f = assembleStaticFindings(doc, 'https://e.com/p').find((x) => x.checkId === 'claim_without_evidence')
    expect(f, 'no evidence finding produced').toBeTruthy()
    expect(f!.module).toBe('evidence_trust')
    expect(f!.observation).toContain('speed or efficiency')
    expect(f!.observation).not.toMatch(/\{\w+\}/)
    expect(f!.recommendedAction).not.toMatch(/\{\w+\}/)
    expect(f!.evidence.length).toBeGreaterThan(0)
  })

  it('says nothing when a claim is properly supported', async () => {
    const doc = await extract(page('<h1>Acme</h1><h2>Performance</h2><p>Acme Checkout renders the seamless checkout in 180 ms, measured across 1,000 runs in March 2026.</p>'), 'https://e.com/p')
    expect(assembleStaticFindings(doc, 'https://e.com/p').map((f) => f.checkId))
      .not.toContain('claim_without_evidence')
  })
})
