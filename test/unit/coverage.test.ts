import { describe, it, expect } from 'vitest'
import {
  QUESTION_BANK,
  COVERAGE_AREAS,
  MAX_QUESTIONS_PER_PAGE,
  selectCoverageQuestions,
  buildCoverageQuestions,
  rollUpCoverage,
  buildCoverageState,
  COVERAGE_TEMPLATES,
  COVERAGE_SITE_TEMPLATES,
} from '../../src/semantic/coverage'
import { extract } from '../../src/extract/extract'
import type { PageSummary } from '../../src/contracts'

const page = (body: string) =>
  `<!doctype html><html lang="en"><head><title>Acme</title></head><body>${body}</body></html>`

const summary = (o: Partial<PageSummary> = {}): PageSummary => ({
  url: 'https://e.com/a', title: 'A page', purpose: 'sell', businessType: 'saas',
  topicTerms: [], audienceNamed: true, hasAction: true, journeyStage: 'consideration',
  findingCounts: { count: 0, high: 0 }, coverage: null, ...o,
})

describe('the question bank', () => {
  it('is written data, not generated', () => {
    // The whole module rests on this: every question a user reads was written by a
    // person and reviewed. If that stops being true the no-generation guarantee goes.
    expect(QUESTION_BANK.length).toBeGreaterThan(8)
    for (const q of QUESTION_BANK) {
      expect(q.text.endsWith('?'), `${q.id} is not phrased as a question`).toBe(true)
      expect(q.triggers.length, `${q.id} has no triggers`).toBeGreaterThan(0)
      expect(q.area in COVERAGE_AREAS, `${q.id} has an unknown area`).toBe(true)
    }
  })

  it('has unique ids and lowercase triggers', () => {
    const ids = QUESTION_BANK.map((q) => q.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const q of QUESTION_BANK) {
      for (const t of q.triggers) expect(t, `${q.id}: ${t}`).toBe(t.toLowerCase())
    }
  })
})

describe('which questions a page is asked', () => {
  it('asks nothing when the page raises nothing', async () => {
    const doc = await extract(page('<h2>Poetry</h2><p>A short verse about rain in autumn.</p>'), 'https://e.com/')
    expect(selectCoverageQuestions(doc, null)).toEqual([])
  })

  it('asks about price when the page talks about price', async () => {
    const doc = await extract(
      page('<h2>Simple pricing</h2><p>Our pricing is affordable for teams of any size.</p>'),
      'https://e.com/',
    )
    const ids = selectCoverageQuestions(doc, null).map((q) => q.id)
    expect(ids).toContain('q_what_it_costs')
  })

  it('never exceeds the per-page cap', async () => {
    const everyTrigger = QUESTION_BANK.flatMap((q) => q.triggers).join(' ')
    const doc = await extract(page(`<p>${everyTrigger}</p>`), 'https://e.com/')
    expect(selectCoverageQuestions(doc, null).length).toBe(MAX_QUESTIONS_PER_PAGE)
  })

  it('does not ask a shop about developer integrations', async () => {
    const doc = await extract(page('<p>We integrate with the API of your choice.</p>'), 'https://e.com/')
    expect(selectCoverageQuestions(doc, 'nonprofit').map((q) => q.id)).not.toContain('q_integrations')
    expect(selectCoverageQuestions(doc, 'saas').map((q) => q.id)).toContain('q_integrations')
  })

  it('keeps every question when the business type is unknown', async () => {
    // Business type is decided in the same call these questions ride in, so it is not
    // known when they are chosen. A guess must not be able to silence a check.
    const doc = await extract(page('<p>Our pricing starts somewhere.</p>'), 'https://e.com/')
    expect(selectCoverageQuestions(doc, null).map((q) => q.id)).toContain('q_what_it_costs')
  })
})

describe('the question put to the model', () => {
  it('quotes the bank question as the subject, with three separable options', () => {
    const q = buildCoverageQuestions([QUESTION_BANK[0]!]).q_what_is_it as {
      instructions: string
      criteria: Record<string, string>
    }
    expect(q.instructions).toContain(QUESTION_BANK[0]!.text)
    expect(Object.keys(q.criteria)).toEqual(['answers_it', 'mentions_only', 'not_addressed'])
  })
})

describe('the site roll-up', () => {
  const pricing = 'q_what_it_costs'

  it('counts a question answered anywhere as covered', () => {
    const rows = rollUpCoverage([
      summary({ url: 'https://e.com/a', coverage: { raised: [pricing], answered: [] } }),
      summary({ url: 'https://e.com/b', coverage: { raised: [pricing], answered: [pricing] } }),
    ])
    expect(rows.find((r) => r.id === pricing)!.status).toBe('answered')
  })

  it('separates raised-but-never-answered from never-raised', () => {
    const rows = rollUpCoverage([
      summary({ coverage: { raised: [pricing], answered: [] } }),
    ])
    expect(rows.find((r) => r.id === pricing)!.status).toBe('unanswered')
    expect(rows.find((r) => r.id === 'q_support')!.status).toBe('absent')
  })

  it('drops questions that do not apply to the business type', () => {
    const rows = rollUpCoverage([summary({ businessType: 'personal', coverage: null })])
    expect(rows.map((r) => r.id)).not.toContain(pricing)
  })

  it('makes absence a table row, not a finding', () => {
    // A dozen "you never mention X" findings is the advice this module replaces. The
    // rows still exist so the reader can see what was considered.
    const rows = rollUpCoverage([summary({ coverage: { raised: [], answered: [] } })])
    expect(rows.some((r) => r.status === 'absent')).toBe(true)
    expect(Object.keys(COVERAGE_SITE_TEMPLATES)).toEqual(['question_unanswered_sitewide'])
  })
})

describe('the finding copy', () => {
  it('faults a page only for leaving its own question hanging', () => {
    const ids = Object.keys(COVERAGE_TEMPLATES)
    expect(ids).toEqual(['question_raised_unanswered'])
    expect(COVERAGE_TEMPLATES.question_raised_unanswered!.observation).toContain('raises')
  })

  it('fills every slot it declares', () => {
    const filled = COVERAGE_SITE_TEMPLATES.question_unanswered_sitewide!.observation
      .replace('{question}', 'What does it cost?')
      .replace('{pages}', '3 pages')
    expect(filled).not.toMatch(/\{\w+\}/)
  })
})

describe('the state coverage is judged against', () => {
  const pricingPage = page(
    '<h2>Simple pricing</h2><p>$49 per site per year, billed once.</p>' +
      Array.from({ length: 12 }, (_, i) => `<p>Filler paragraph ${i} with nothing relevant in it at all.</p>`).join('') +
      '<h2>Support</h2><p>Support is included for twelve months.</p>',
  )

  it('carries the sentence after a trigger, where the answer usually is', async () => {
    // "Simple pricing" is the trigger; the figure lands in the next sentence and
    // contains no trigger term of its own. Dropping it would report a page that states
    // its price as not stating it.
    const doc = await extract(pricingPage, 'https://e.com/')
    const selected = selectCoverageQuestions(doc, null)
    const state = buildCoverageState(doc, selected) as unknown as {
      state: { relevant_text: string[] }
    }
    expect(state.state.relevant_text.join(' ')).toContain('$49 per site per year')
  })

  it('leaves the filler out', async () => {
    const doc = await extract(pricingPage, 'https://e.com/')
    const state = buildCoverageState(doc, selectCoverageQuestions(doc, null)) as unknown as {
      state: { relevant_text: string[] }
    }
    const filler = state.state.relevant_text.filter((t) => t.includes('Filler paragraph'))
    // One either side of a trigger passage is expected; a dozen is the whole page.
    expect(filler.length).toBeLessThan(4)
  })

  it('stays inside a local Laya checkpoint budget', async () => {
    const huge = page(
      Array.from(
        { length: 60 },
        (_, i) => `<p>Our pricing and support and security and setup notes, part ${i}.</p>`,
      ).join(''),
    )
    const doc = await extract(huge, 'https://e.com/')
    const state = buildCoverageState(doc, selectCoverageQuestions(doc, null))
    expect(state.estimatedTokens).toBeLessThan(700)
  })
})
