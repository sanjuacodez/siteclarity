import { describe, it, expect } from 'vitest'
import { stageCounts, findStageGaps, JOURNEY_STAGES, STAGE_LABELS, STAGE_COST_PUBLIC } from '../../src/semantic/site'
import { JOURNEY_QUESTIONS } from '../../src/semantic/questions'
import type { PageSummary } from '../../src/contracts'

const page = (journeyStage: string | null): PageSummary => ({
  url: 'https://e.com/a', title: 'A', purpose: 'explain', businessType: 'saas',
  topicTerms: [], audienceNamed: null, hasAction: true, journeyStage,
  findingCounts: { count: 0, high: 0 }, coverage: null,
})

describe('Module 6 — buyer journey', () => {
  it('offers every stage from the brief, plus none', () => {
    const opts = Object.keys((JOURNEY_QUESTIONS.journey_stage as { criteria: Record<string, string> }).criteria)
    for (const stage of JOURNEY_STAGES) expect(opts).toContain(stage)
    // A page serving no stage must be sayable, or navigation inflates coverage.
    expect(opts).toContain('none')
  })

  it('counts pages per stage and ignores unplaced ones', () => {
    const counts = stageCounts([page('education'), page('education'), page('none'), page(null)])
    expect(counts.education).toBe(2)
    expect(counts.awareness).toBe(0)
    // 'none' is not a stage, so it must not land in any bucket.
    expect(Object.values(counts).reduce((a, b) => a + b, 0)).toBe(2)
  })

  it('stays silent until there is enough content for absence to mean something', () => {
    // A three-page site legitimately has gaps; reporting them would be noise.
    expect(findStageGaps([page('education'), page('education'), page('decision')])).toEqual([])
  })

  it('reports the stages a substantial site leaves empty', () => {
    const gaps = findStageGaps([
      page('education'), page('education'), page('education'), page('education'), page('decision'),
    ])
    const missing = gaps.map((g) => g.stage)
    expect(missing).toContain('awareness')
    expect(missing).toContain('comparison')
    expect(missing).not.toContain('education')
    expect(missing).not.toContain('decision')
  })

  it('notes where the content piled up instead', () => {
    const gaps = findStageGaps([page('education'), page('education'), page('education'), page('education')])
    expect(gaps[0]!.concentratedIn).toBe('education')
  })

  it('does not claim concentration when content is spread', () => {
    const gaps = findStageGaps([page('education'), page('decision'), page('comparison'), page('purchase')])
    expect(gaps[0]?.concentratedIn ?? null).toBeNull()
  })

  it('explains every stage in the reader’s terms, not in jargon', () => {
    for (const stage of JOURNEY_STAGES) {
      expect(STAGE_LABELS[stage], `${stage} has no label`).toBeTruthy()
      expect(STAGE_COST_PUBLIC[stage], `${stage} has no cost explained`).toBeTruthy()
      // The label completes "No page here is written for ..." — so it describes people.
      expect(STAGE_LABELS[stage]).toMatch(/people|someone|anyone|nobody/i)
    }
  })

  it('reports gaps, never a coverage score', () => {
    // "Journey coverage 4/6" tells nobody what to do next.
    const gaps = findStageGaps(Array.from({ length: 5 }, () => page('education')))
    expect(Array.isArray(gaps)).toBe(true)
    expect(JSON.stringify(gaps)).not.toMatch(/score|percent|rating/i)
  })
})

describe('journey findings belong to the journey module', () => {
  it('registers journey templates under buyer_journey, not audience coverage', async () => {
    // The shared site helper defaulted every finding to audience_coverage, which filed
    // journey findings under the wrong module in the report.
    const { TEMPLATE_GROUPS } = await import('../../src/checks/registry')
    const group = TEMPLATE_GROUPS.find((g) => g.id === 'journey')
    expect(group, 'no journey group registered').toBeTruthy()
    expect(group!.module).toBe('buyer_journey')
    expect(Object.keys(group!.templates)).toContain('journey_stage_missing')
    expect(Object.keys(group!.templates)).toContain('journey_concentrated')
  })

  it('lists buyer journey as a built module', async () => {
    const { builtModules, plannedModules } = await import('../../src/checks/registry')
    expect(builtModules()).toContain('buyer_journey')
    expect(plannedModules()).not.toContain('buyer_journey')
  })
})
