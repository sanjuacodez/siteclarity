import { describe, it, expect } from 'vitest'
import { extract } from '../../src/extract/extract'
import { runLanguageSignals, languageSupported } from '../../src/static/language/signals'

const page = (body: string, lang = 'en') =>
  `<!doctype html><html lang="${lang}"><head><title>Page title here</title></head><body>${body}</body></html>`

const signalsFor = async (body: string, lang = 'en') => {
  const doc = await extract(page(body, lang), 'https://e.com/')
  return runLanguageSignals(doc, doc.passages).map((s) => s.checkId)
}

describe('SC-107 language signals', () => {
  it('flags passages that keep opening with a pronoun', async () => {
    const ids = await signalsFor(
      '<p>The plugin adds checkout fields to your store for customers. ' +
      'It handles validation automatically without any configuration at all. ' +
      'This means fewer support tickets for your team over time. ' +
      'They also reduce abandoned carts across the whole checkout flow.</p>',
    )
    expect(ids).toContain('high_anaphora')
  })

  it('leaves self-contained prose alone', async () => {
    const ids = await signalsFor(
      '<p>The checkout plugin adds custom fields to WooCommerce stores. ' +
      'Validation runs automatically on submit, with no configuration needed. ' +
      'Store owners report fewer support tickets after installing the plugin.</p>',
    )
    expect(ids).not.toContain('high_anaphora')
  })

  it('flags vague quantifiers with no figures', async () => {
    // Must clear MIN_WORDS_FOR_DENSITY (25) or density measures are meaningless.
    const ids = await signalsFor(
      '<p>Our platform supports many integrations and several deployment options for teams. ' +
      'Numerous customers report substantial improvements across various workflows every single day. ' +
      'Most teams see plenty of benefit within a few weeks of getting started.</p>',
    )
    expect(ids).toContain('vague_quantifiers')
  })

  it('ignores passages too short for density to mean anything', async () => {
    expect(await signalsFor('<p>Many things. Several others.</p>')).toEqual([])
  })

  it('accepts vague words when real figures are present', async () => {
    const ids = await signalsFor(
      '<p>Our platform supports many integrations — 42 of them today, up from 12 in 2024. ' +
      'Customers report a 38% reduction in setup time across various workflows.</p>',
    )
    expect(ids).not.toContain('vague_quantifiers')
  })

  it('flags very long sentences', async () => {
    const long = 'word '.repeat(60).trim()
    expect(await signalsFor(`<p>${long}.</p>`)).toContain('long_sentences')
  })

  it('returns nothing for a non-English page rather than guessing', async () => {
    expect(await signalsFor(
      '<p>Unsere Plattform unterstuetzt viele Integrationen und mehrere Optionen. ' +
      'Es bedeutet weniger Aufwand fuer Ihr Team in jeder Hinsicht heute.</p>', 'de',
    )).toEqual([])
  })

  it('treats an unlabelled page as English rather than skipping it', async () => {
    const doc = await extract(
      '<!doctype html><html><head><title>T</title></head><body><p>x</p></body></html>',
      'https://e.com/',
    )
    expect(languageSupported(doc)).toBe(true)
  })
})

describe('long sentence false positives', () => {
  it('does not treat an unpunctuated list item as one long sentence', async () => {
    const item = 'word '.repeat(45).trim()
    const doc = await extract(
      `<!doctype html><html lang="en"><head><title>T</title></head><body>
       <ul><li>${item}</li><li>${item}</li></ul></body></html>`,
      'https://e.com/',
    )
    expect(runLanguageSignals(doc, doc.passages).map((s) => s.checkId))
      .not.toContain('long_sentences')
  })

  it('still flags a genuinely long paragraph', async () => {
    const doc = await extract(
      `<!doctype html><html lang="en"><head><title>T</title></head><body>
       <p>${'word '.repeat(60).trim()}.</p></body></html>`,
      'https://e.com/',
    )
    expect(runLanguageSignals(doc, doc.passages).map((s) => s.checkId))
      .toContain('long_sentences')
  })
})
