import { describe, it, expect } from 'vitest'
import { extract } from '../../src/extract/extract'
import { runStaticChecks } from '../../src/static/structure/checks'
import { runLanguageSignals } from '../../src/static/language/signals'

/**
 * SC-106 / SC-107 — boundary cases.
 *
 * A deterministic check cannot return `cannot_assess`, so the honest equivalent is that
 * it must STAY SILENT when the signal is ambiguous rather than guess. A check that fires
 * on a borderline case produces advice nobody can act on, which is the failure mode this
 * product exists to avoid.
 *
 * Each block below is a case where firing would be wrong.
 */
const page = (body: string, head = '', lang = 'en') =>
  `<!doctype html><html lang="${lang}"><head><title>A specific page title here</title>
   <meta name="description" content="d"><link rel="canonical" href="https://e.com/p">${head}</head>
   <body>${body}</body></html>`

const ids = async (body: string, head = '', lang = 'en') => {
  const doc = await extract(page(body, head, lang), 'https://e.com/p')
  return runStaticChecks(doc, 'https://e.com/p').map((r) => r.checkId)
}
const langIds = async (body: string, lang = 'en') => {
  const doc = await extract(page(body, '', lang), 'https://e.com/p')
  return runLanguageSignals(doc, doc.passages).map((s) => s.checkId)
}

describe('structured data edges', () => {
  it('stays silent when JSON-LD is valid but of an unrelated type', async () => {
    const head = '<script type="application/ld+json">{"@type":"BreadcrumbList","name":"x"}</script>'
    expect(await ids('<h1>A</h1><p>text</p>', head)).not.toContain('no_structured_data')
  })

  it('does not demand FAQ markup for one or two question headings', async () => {
    // Threshold is 3; below it, a page is not "structured as Q&A".
    const body = '<h1>A</h1><h2>What is X?</h2><p>text</p><h2>How does Y work?</h2><p>text</p>'
    expect(await ids(body)).not.toContain('missing_faq_markup')
  })

  it('does demand it once the page is clearly a Q&A', async () => {
    const body = '<h1>A</h1><h2>What is X?</h2><p>t</p><h2>How does Y work?</h2><p>t</p>' +
      '<h2>Why does Z matter?</h2><p>t</p>'
    expect(await ids(body)).toContain('missing_faq_markup')
  })

  it('treats an empty JSON-LD array as present, not malformed', async () => {
    const head = '<script type="application/ld+json">[]</script>'
    expect(await ids('<h1>A</h1><p>t</p>', head)).not.toContain('malformed_structured_data')
  })
})

describe('heading edges', () => {
  it('accepts a single H1 with no subheadings at all', async () => {
    const r = await ids('<h1>Only heading</h1><p>Some text follows it.</p>')
    expect(r).not.toContain('no_h1')
    expect(r).not.toContain('skipped_heading_levels')
    expect(r).not.toContain('multiple_h1')
  })

  it('does not call h1 -> h2 -> h2 -> h3 a skip', async () => {
    const body = '<h1>A</h1><h2>B</h2><p>t</p><h2>C</h2><p>t</p><h3>D</h3><p>t</p>'
    expect(await ids(body)).not.toContain('skipped_heading_levels')
  })

  it('does not treat going back up a level as a skip', async () => {
    // h3 -> h2 is a legitimate return to a shallower level.
    const body = '<h1>A</h1><h2>B</h2><h3>C</h3><p>t</p><h2>D</h2><p>t</p>'
    expect(await ids(body)).not.toContain('skipped_heading_levels')
  })
})

describe('extractability edges', () => {
  it('stays silent on a very short page where ratios mean nothing', async () => {
    expect(await ids('<h1>A</h1><p>One short line.</p>')).not.toContain('no_structured_formats')
  })

  it('counts a table as structure, not just lists', async () => {
    // Cell text must clear the 2-character floor that drops layout fragments.
    const rows = '<table><tr><td>ChatGPT</td><td>Bing index</td></tr>' +
      '<tr><td>Claude</td><td>Brave index</td></tr></table>'
    const body = '<h1>A</h1>' + '<p>Sentence number one here.</p>'.repeat(8) + rows
    expect(await ids(body)).not.toContain('no_structured_formats')
  })

  it('does not flag a long page whose paragraphs are each short', async () => {
    const body = '<h1>A</h1><ul><li>x</li></ul>' + '<p>A short paragraph here.</p>'.repeat(20)
    expect(await ids(body)).not.toContain('passages_too_long')
  })
})

describe('machine access edges', () => {
  it('does not flag a canonical that differs only by path', async () => {
    const head = '<link rel="canonical" href="https://e.com/other-path">'
    const r = await ids('<h1>A</h1><p>t</p>', head)
    expect(r).not.toContain('canonical_offsite')
    expect(r).not.toContain('canonical_invalid')
  })

  it('treats a relative canonical as valid', async () => {
    const head = '<link rel="canonical" href="/p">'
    expect(await ids('<h1>A</h1><p>t</p>', head)).not.toContain('canonical_invalid')
  })

  it('does not read "index,follow" as noindex', async () => {
    const head = '<meta name="robots" content="index, follow, max-snippet:-1">'
    expect(await ids('<h1>A</h1><p>t</p>', head)).not.toContain('meta_noindex')
  })

  it('does not mistake a text-light page with real prose for JS rendering', async () => {
    const body = '<h1>A</h1><p>' + 'word '.repeat(150) + '</p><script>var x=1;</script>'
    expect(await ids(body)).not.toContain('js_dependent')
  })
})

describe('language signal edges', () => {
  it('stays silent on a single-sentence passage', async () => {
    // Anaphora is a ratio over sentences; one sentence carries no ratio.
    expect(await langIds('<p>It does the thing that you would expect it to do here.</p>'))
      .not.toContain('high_anaphora')
  })

  it('does not flag "this" used as a determiner with a noun', async () => {
    const body = '<p>The plugin adds fields to checkout pages for store owners everywhere. ' +
      'Store owners configure each field from the settings screen without writing code. ' +
      'Validation runs automatically whenever a customer submits the checkout form.</p>'
    expect(await langIds(body)).not.toContain('high_anaphora')
  })

  it('accepts vague words when a figure is present in the same passage', async () => {
    const body = '<p>Many teams adopt this quickly and see real gains within weeks of setup. ' +
      'Across 42 deployments the median setup time was 18 minutes from start to finish. ' +
      'Several customers reported a 30% drop in support tickets over the first quarter.</p>'
    expect(await langIds(body)).not.toContain('vague_quantifiers')
  })

  it('returns nothing at all for a non-English page', async () => {
    const body = '<p>Unsere Plattform unterstuetzt viele Integrationen und mehrere Optionen fuer Teams. ' +
      'Es bedeutet weniger Aufwand fuer Ihr Team in jeder Hinsicht an jedem Tag. ' +
      'Die meisten Kunden berichten von erheblichen Verbesserungen in kurzer Zeit.</p>'
    expect(await langIds(body, 'de')).toEqual([])
  })
})
