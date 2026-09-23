import { describe, it, expect } from 'vitest'
import { extract } from '../../src/extract/extract'
import {
  shortlistPassages,
  buildProfileQuestions,
  buildProfileState,
  NOT_STATED,
  DIMENSION_LABELS,
  ABSENT_REASONS,
} from '../../src/semantic/profile'
import { ProfileDimension } from '../../src/contracts'

const page = (body: string) =>
  `<!doctype html><html lang="en"><head><title>Acme Checkout</title>
   <meta name="description" content="Checkout fields for WooCommerce."></head><body>${body}</body></html>`

describe('Module 4 — selection, never generation', () => {
  it('offers the page’s own sentences as the options', async () => {
    const doc = await extract(page(
      '<h1>Acme</h1><p>Acme Checkout adds conditional fields to the WooCommerce checkout page.</p>' +
      '<p>It is built for stores selling made-to-order goods that need extra detail.</p>'), 'https://e.com/')
    const candidates = shortlistPassages(doc, new Set())
    const questions = buildProfileQuestions(candidates)

    const opts = (questions.what_it_does as { criteria: Record<string, string> }).criteria
    // Every option is either one of this page's sentences or the absent marker.
    for (const [key, text] of Object.entries(opts)) {
      if (key === NOT_STATED) continue
      const match = candidates.find((c) => c.text.startsWith(text.replace(/…$/, '')))
      expect(match, `option ${key} is not a page sentence`).toBeTruthy()
    }
  })

  it('always allows "not stated", so the model is never forced to invent one', () => {
    const questions = buildProfileQuestions([])
    for (const [id, q] of Object.entries(questions)) {
      expect(Object.keys(q.criteria), `${id} has no absent option`).toContain(NOT_STATED)
    }
  })

  it('asks for a business type from a closed taxonomy, needing no passage', () => {
    const q = buildProfileQuestions([]).business_type as { criteria: Record<string, string> }
    expect(Object.keys(q.criteria).length).toBeGreaterThan(5)
    expect(Object.keys(q.criteria)).toContain('saas')
    expect(Object.keys(q.criteria)).toContain(NOT_STATED)
  })

  it('shortlists prose from the top, skipping labels and walls of text', async () => {
    const doc = await extract(page(
      '<h1>Acme</h1><p>Buy</p>' +
      '<p>Acme Checkout adds conditional fields to the WooCommerce checkout page today.</p>' +
      `<p>${'word '.repeat(90).trim()}</p>`), 'https://e.com/')
    const texts = shortlistPassages(doc, new Set()).map((p) => p.text)
    expect(texts).toContain('Acme Checkout adds conditional fields to the WooCommerce checkout page today.')
    expect(texts.some((t) => t === 'Buy'), 'a two-word label was shortlisted').toBe(false)
    expect(texts.some((t) => t.split(/\s+/).length > 60), 'a wall of text was shortlisted').toBe(false)
  })

  it('keeps the state small enough for a local Laya checkpoint', async () => {
    const doc = await extract(page(
      Array.from({ length: 20 }, (_, i) =>
        `<p>Sentence number ${i} describing what the product does for its customers here.</p>`).join('')),
      'https://e.com/')
    const candidates = shortlistPassages(doc, new Set())
    const state = buildProfileState(doc, 'https://e.com/', candidates)
    // Laya English is 512 tokens total, roughly 320 for state.
    expect(state.estimatedTokens).toBeLessThan(320)
    expect(candidates.length).toBeLessThanOrEqual(8)
  })

  it('has a label and an absent reason for every dimension', () => {
    for (const d of ProfileDimension.options) {
      expect(DIMENSION_LABELS[d], `${d} has no label`).toBeTruthy()
      expect(ABSENT_REASONS[d], `${d} has no absent reason`).toBeTruthy()
      // Absence is the answer, not a telling-off.
      expect(ABSENT_REASONS[d]).not.toMatch(/should|must|fail/i)
    }
  })

  it('excludes testimonials and boilerplate from the shortlist', async () => {
    const doc = await extract(page(
      '<h1>Acme</h1><p>Acme Checkout adds conditional fields to WooCommerce stores everywhere.</p>' +
      '<h2>janedoe</h2><p>I love this plugin, it saved me hours of work every single week.</p>' +
      '<h2>bobsmith</h2><p>I have used it for months and my customers have never complained once.</p>' +
      '<h2>caroljones</h2><p>I recommend it to everyone I know who runs an online store today.</p>'),
      'https://e.com/')
    const { excludedSections } = await import('../../src/semantic/state')
    const texts = shortlistPassages(doc, excludedSections(doc)).map((p) => p.text)
    expect(texts.some((t) => t.startsWith('I love this plugin'))).toBe(false)
  })
})
