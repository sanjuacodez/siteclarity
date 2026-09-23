import { describe, it, expect } from 'vitest'
import {
  buildOpportunities,
  SYSTEMIC_PAGES,
  MAX_OPPORTUNITIES,
  OPPORTUNITY_RULES,
  type GroupableFinding,
} from '../../src/assemble/opportunities'
import { assertNoOverallScore } from '../../src/contracts'

const f = (checkId: string, page: string, id = `${checkId}:${page}`): GroupableFinding => ({
  id,
  checkId,
  module: 'ai_readiness',
  affects: [{ pageUrl: page }],
})

const pages = (n: number) => Array.from({ length: n }, (_, i) => `https://e.com/p${i}`)

describe('the same problem across pages becomes one job', () => {
  it('groups a check that recurs on enough pages', () => {
    const findings = pages(4).map((p) => f('claim_without_evidence', p))
    const out = buildOpportunities(findings, 4)
    expect(out).toHaveLength(1)
    expect(out[0]!.fromFindings).toHaveLength(4)
    expect(out[0]!.rationale).toContain('4 pages')
  })

  it('leaves a problem on two pages as two findings', () => {
    // Two occurrences is a coincidence. Promoting it would make the plan longer
    // without making it truer.
    const findings = pages(SYSTEMIC_PAGES - 1).map((p) => f('claim_without_evidence', p))
    expect(buildOpportunities(findings, SYSTEMIC_PAGES - 1)).toEqual([])
  })

  it('counts pages on a site scan, so one busy page is not a site pattern', () => {
    const many = Array.from({ length: 6 }, (_, i) =>
      f('claim_without_evidence', 'https://e.com/one', `dup${i}`),
    )
    expect(buildOpportunities(many, 12)).toEqual([])
  })

  it('counts occurrences on a single-page audit, where there is only one page', () => {
    // Counting pages made the plan permanently empty for anyone auditing one URL — the
    // invisible-module problem module 5 had. Six unbacked claims is one job whether or
    // not a second page exists.
    const many = Array.from({ length: 6 }, (_, i) =>
      f('claim_without_evidence', 'https://e.com/one', `dup${i}`),
    )
    const out = buildOpportunities(many, 1)
    expect(out).toHaveLength(1)
    expect(out[0]!.rationale).toContain('6 claims')
    expect(out[0]!.rationale).not.toContain('pages')
  })

  it('ignores a recurring check it has no copy for', () => {
    // A check with no entry never becomes an opportunity, which is the right default:
    // nothing here may be written at runtime.
    const findings = pages(5).map((p) => f('some_unknown_check', p))
    expect(buildOpportunities(findings, 5)).toEqual([])
  })
})

describe('a site-level finding is already a piece of work', () => {
  it('passes it through, reworded as something to do', () => {
    const out = buildOpportunities([f('journey_stage_missing', 'https://e.com/')], 5)
    expect(out).toHaveLength(1)
    expect(out[0]!.title).toMatch(/write for/i)
    // Reworded from what is wrong to what to do: no "missing" in the instruction.
    expect(out[0]!.title).not.toMatch(/missing/i)
  })
})

describe('unanswered questions in one subject are one gap', () => {
  const q = (bankId: string, page: string): GroupableFinding => ({
    id: `question_raised_unanswered:${bankId}`,
    checkId: 'question_raised_unanswered',
    module: 'question_coverage',
    affects: [{ pageUrl: page }],
  })

  it('groups by the area the question bank declares', () => {
    const out = buildOpportunities(
      [q('q_what_it_costs', 'https://e.com/a'), q('q_free_tier', 'https://e.com/b')],
      2,
    )
    expect(out.map((o) => o.id)).toContain('area:pricing')
    expect(out.find((o) => o.id === 'area:pricing')!.title).toMatch(/costs/i)
  })

  it('leaves a single unanswered question alone', () => {
    // One question is not yet a subject.
    const out = buildOpportunities([q('q_what_it_costs', 'https://e.com/a')], 2)
    expect(out.map((o) => o.id)).not.toContain('area:pricing')
  })

  it('does not say the same thing twice', () => {
    // The recurring rule would also fire on these. Whichever wins, each finding must
    // appear behind exactly one item, or the plan reads as two jobs for one edit.
    const findings = [
      q('q_what_it_costs', 'https://e.com/a'),
      q('q_free_tier', 'https://e.com/b'),
      q('q_data_safety', 'https://e.com/c'),
    ]
    const out = buildOpportunities(findings, 3)
    const seen = out.flatMap((o) => o.fromFindings)
    expect(new Set(seen).size).toBe(seen.length)
  })
})

describe('the plan stays a plan', () => {
  it('never returns more than a person can act on', () => {
    const findings = [
      ...pages(4).map((p) => f('claim_without_evidence', p)),
      ...pages(4).map((p) => f('vague_claim', p)),
      ...pages(4).map((p) => f('heavily_promotional', p)),
      ...pages(4).map((p) => f('answer_absent', p)),
      ...pages(4).map((p) => f('not_self_contained', p)),
      ...pages(4).map((p) => f('audience_not_named', p)),
      ...pages(4).map((p) => f('no_differentiation', p)),
      ...pages(4).map((p) => f('passages_too_long', p)),
    ]
    expect(buildOpportunities(findings, 4).length).toBeLessThanOrEqual(MAX_OPPORTUNITIES)
  })

  it('orders the same input the same way every time', () => {
    const findings = [
      ...pages(3).map((p) => f('answer_absent', p)),
      ...pages(3).map((p) => f('heavily_promotional', p)),
    ]
    const a = buildOpportunities(findings, 3).map((o) => o.id)
    const b = buildOpportunities([...findings].reverse(), 3).map((o) => o.id)
    expect(a).toEqual(b)
    // What blocks a section outranks what merely weakens the text.
    expect(a[0]).toBe('recurring:answer_absent')
  })

  it('carries no score, only a rank', () => {
    // A ranked list is exactly the shape that invites "impact 8.4/10".
    const out = buildOpportunities(pages(3).map((p) => f('answer_absent', p)), 3)
    assertNoOverallScore({ opportunities: out })
    for (const o of out) {
      expect(JSON.stringify(o)).not.toMatch(/score|rating|percent|\/10/i)
    }
  })

  it('says nothing when there is nothing to say', () => {
    expect(buildOpportunities([], 12)).toEqual([])
  })
})

describe('the documented rules are the real ones', () => {
  it('describes every rule the grouping actually applies', () => {
    expect(OPPORTUNITY_RULES.map((r) => r.id)).toEqual(['recurring', 'site_level', 'by_area'])
    for (const rule of OPPORTUNITY_RULES) expect(rule.covers()).toBeGreaterThan(0)
  })
})
