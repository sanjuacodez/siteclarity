import { describe, it, expect } from 'vitest'
import { DASHBOARD_HTML } from '../../src/ui/dashboard'
import { renderChecksPage } from '../../src/ui/checks'
import {
  TEMPLATE_GROUPS,
  QUESTION_GROUPS,
  builtModules,
  plannedModules,
  MODULE_INFO,
  allCheckIds,
} from '../../src/checks/registry'
import { EVIDENCE_TEMPLATES } from '../../src/static/evidence/templates'
import { MESSAGING_TEMPLATES, MESSAGING_JUDGED } from '../../src/static/messaging/templates'
import { EVIDENCE_QUESTIONS, MESSAGING_QUESTIONS } from '../../src/semantic/questions'
import type { AnalysisResult, Finding } from '../../src/contracts'
import { ProfileDimension } from '../../src/contracts'
import { CHECKS } from '../../src/assemble/checks'
import { COVERAGE_AREAS } from '../../src/semantic/coverage'
import { STATIC_TEMPLATES } from '../../src/static/structure/templates'
import { LANGUAGE_TEMPLATES } from '../../src/static/language/signals'
import { PAGE_QUESTIONS, SECTION_QUESTIONS, PASSAGE_QUESTIONS } from '../../src/semantic/questions'

const script = DASHBOARD_HTML.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? ''

// Synthetic presentation data only: these are not recorded model answers or evidence fixtures.
function finding(overrides: Partial<Finding> = {}): Finding {
  return {
    id: 'presentation-finding', module: 'ai_readiness', checkId: 'presentation-check',
    observation: 'Presentation finding', whyItMatters: 'Presentation explanation',
    recommendedAction: 'Presentation next step', priority: 'high', confidence: 'medium',
    evidence: [{ passageId: 'synthetic-passage', sectionId: 'synthetic-section', quote: 'Synthetic source text for presentation tests.' }],
    affects: [{ pageUrl: 'https://example.test/page', sectionId: 'synthetic-section' }],
    highlights: [], copySource: 'template', ...overrides,
  }
}

function report(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    schemaVersion: '0.1.0',
    input: { requestedUrl: 'https://example.test/page', finalUrl: 'https://example.test/page', fetchedAt: '2026-09-22T00:00:00Z', title: 'Presentation page' },
    limits: { scope: 'single_page', statements: ['Only this synthetic page was examined.'], decisionsRan: true, sectionsAnalyzed: 1, sectionsTotal: 1, stateSplit: false, language: 'en', languageSupported: true, jsDependent: false },
    profile: [],
    coverage: [],
    opportunities: [],
    summary_for_site: null,
    sections: [{ sectionId: 'synthetic-section', heading: 'Actual section heading', level: 2, passageCount: 1, decisions: {} }],
    findings: [finding()],
    provider: { backend: 'none', model: null, calls: 0, inputTokens: 0, outputTokens: 0, degraded: false, degradedReason: null },
    timings: { totalMs: 12, extractMs: 5, decideMs: 0 }, ...overrides,
  }
}

type TestEvent = { target: StubElement; key?: string; preventDefault(): void }
type Listener = (event: TestEvent) => void | Promise<void>

// Minimal event/element boundary, not a DOM implementation. Native layout/disclosure is browser-tested.
class StubElement {
  value = ''
  hidden = false
  disabled = false
  tabIndex = 0
  innerHTML = ''
  textContent = ''
  validityMessage = ''
  focused = false
  validityReported = false
  dataset: Record<string, string> = {}
  attributes = new Map<string, string>()
  listeners = new Map<string, Listener>()
  controls: StubElement[] = []
  classes = new Set<string>()
  classList = {
    contains: (name: string) => this.classes.has(name),
    toggle: (name: string, on: boolean) => on ? this.classes.add(name) : this.classes.delete(name),
  }
  constructor(readonly id = '') {}
  setAttribute(name: string, value: string) { this.attributes.set(name, value) }
  getAttribute(name: string) { return this.attributes.get(name) ?? null }
  addEventListener(name: string, listener: Listener) { this.listeners.set(name, listener) }
  querySelectorAll() { return this.controls }
  closest(selector: string) { return this.classes.has(selector.slice(1)) ? this : null }
  focus() { this.focused = true }
  // Real elements have this; the dashboard calls it after rendering a report.
  scrollIntoView() {}
  setCustomValidity(message: string) { this.validityMessage = message }
  reportValidity() { this.validityReported = true }
}

interface SitemapPresentation {
  urls: string[]; totalFound: number; truncated: boolean; sitemapUrl: string | null
}
interface FailurePresentation { url: string; error: { message: string } }
interface PresentationApi {
  render(data: AnalysisResult): string
  renderErr(data: { error?: { message: string } }): string
  renderSite(data: AnalysisResult[], meta: SitemapPresentation, failures: FailurePresentation[], partial: boolean): string
  renderGroups(data: Finding[], sections: AnalysisResult['sections']): string
  findingsBody(data: AnalysisResult, filter: string): string
  mark(quote: string, terms: string[]): string
  readUrls(raw: string): string[]
  parseUrlList(raw: string): string[]
  validateList(): boolean
  selectMode(mode: string, focus: boolean): void
  setBusy(busy: boolean): void
  sectionName(finding: Finding, sections: AnalysisResult['sections']): string
  shortPath(url: string): string
}

function harness(response: AnalysisResult = report(), requestError?: string) {
  const elements = new Map<string, StubElement>()
  const element = (id: string) => {
    let item = elements.get(id)
    if (!item) { item = new StubElement(id); elements.set(id, item) }
    return item
  }
  const tabs = ['page', 'site', 'list'].map((mode) => {
    const tab = element('tab-' + mode)
    tab.dataset.m = mode; tab.classes.add('mtab')
    if (mode === 'page') tab.classes.add('on')
    return tab
  })
  for (const [mode, ids] of Object.entries({ page: ['u', 'b'], site: ['us', 'np', 'site-submit'], list: ['ul', 'list-submit'] })) {
    element('pane-' + mode).controls = ids.map(element)
  }
  const chips = ['all', 'high', 'medium', 'low'].map((priority) => {
    const chip = element('chip-' + priority)
    chip.classes.add('chip'); chip.dataset.f = priority
    return chip
  })
  const listeners = new Map<string, Listener>()
  const document = {
    getElementById: element,
    addEventListener: (name: string, listener: Listener) => listeners.set(name, listener),
    querySelector: () => tabs.find((tab) => tab.classes.has('on')),
    querySelectorAll: (selector: string) => selector === '.mtab' ? tabs : selector === '.chip' ? chips : [],
  }
  const requests: string[] = []
  const fetch = async (_url: string, init?: { body?: string }) => {
    requests.push(init?.body ?? '')
    return { ok: !requestError, json: async () => requestError ? { error: { message: requestError } } : response }
  }
  // Evaluating exact exported bindings catches missing render/renderErr helpers. Prefix substring
  // checks previously accepted "function renderSite" as proof that "function render" existed.
  const api = new Function('document', 'fetch', script + '\nreturn { render, renderErr, renderSite, renderGroups, findingsBody, mark, readUrls, parseUrlList, validateList, selectMode, setBusy, sectionName, shortPath };')(document, fetch) as PresentationApi
  const dispatch = async (name: string, target: StubElement, key?: string) => {
    const listener = name === 'submit' ? element('f').listeners.get(name) : listeners.get(name)
    if (!listener) throw new Error('Missing event listener: ' + name)
    await listener({ target, key, preventDefault() {} })
  }
  return { api, element, tabs, chips, requests, dispatch }
}

function metadata(urls = ['https://example.test/page']): SitemapPresentation {
  return { urls, totalFound: urls.length, truncated: false, sitemapUrl: null }
}

describe('emitted dashboard script', () => {
  it('compiles and executes against the document boundary', () => {
    expect(script.length).toBeGreaterThan(1000)
    expect(() => harness()).not.toThrow()
  })

  it('keeps newline, whitespace and trailing-slash regexes functional', () => {
    const { api } = harness()
    expect(api.parseUrlList('  https://a.test/x\nhttps://b.test/y,\n\n')).toEqual(['https://a.test/x', 'https://b.test/y'])
    expect(api.shortPath('https://example.test/path/')).toBe('/path')
    expect(api.shortPath('https://example.test/')).toBe('/')
  })

  it('actually submits and renders a single-page report', async () => {
    const h = harness()
    h.element('u').value = 'https://example.test/page'
    await h.dispatch('submit', h.element('f'))
    expect(h.requests).toEqual(['{"url":"https://example.test/page"}'])
    expect(h.element('out').innerHTML).toContain('Presentation finding')
    expect(h.element('out').innerHTML).toContain('Presentation next step')
    expect(h.element('out').innerHTML).toContain('Only this synthetic page was examined.')
    expect(h.element('status').textContent).toBe('Audit complete. 1 findings.')
    expect(h.element('out').focused).toBe(true)
    expect(h.element('f').getAttribute('aria-busy')).toBe('false')
    expect(h.element('u').disabled).toBe(false)
  })

  it('renders recoverable, escaped request errors and releases busy inputs', async () => {
    const h = harness(report(), '<script>bad request</script>')
    await h.dispatch('submit', h.element('f'))
    expect(h.element('out').innerHTML).toContain('role="alert"')
    expect(h.element('out').innerHTML).toContain('&lt;script&gt;bad request&lt;/script&gt;')
    expect(h.element('out').innerHTML).not.toContain('<script>')
    expect(h.element('f').getAttribute('aria-busy')).toBe('false')
    expect(h.element('status').textContent).toBe('Audit could not be completed.')
  })
})

describe('single-page findings and evidence', () => {
  it('renders a no-findings state while retaining the actual limitations', () => {
    const html = harness().api.render(report({ findings: [] }))
    expect(html).toContain('No findings in the checks completed')
    expect(html).toContain('This does not guarantee readiness.')
    expect(html).toContain('Only this synthetic page was examined.')
  })

  it('makes degraded and unassessed semantic coverage visible even without findings', () => {
    const d = report({ findings: [] })
    d.provider.degraded = true; d.provider.degradedReason = 'Synthetic provider unavailable'
    const { api } = harness()
    expect(api.render(d)).toContain('Partial report · decision model unavailable')
    d.provider.degraded = false; d.limits.decisionsRan = false
    expect(api.render(d)).toContain('Limited semantic coverage')
    expect(api.render(d)).toContain('No section-level decisions were completed.')
  })

  it('escapes hostile source text in titles, findings, evidence, actions and limits', () => {
    const hostile = '<img src=x onerror="alert(1)"> & unsafe'
    const d = report({ findings: [finding({ observation: hostile, whyItMatters: hostile, recommendedAction: hostile, evidence: [{ passageId: hostile, sectionId: hostile, quote: hostile }], highlights: ['unsafe'] })] })
    d.input.title = hostile; d.limits.statements = [hostile]
    const html = harness().api.render(d)
    expect(html).not.toContain('<img')
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; unsafe')
    expect(html).toContain('&lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; <mark>unsafe</mark>')
  })

  it('never makes an unsupported URL scheme clickable', () => {
    const d = report()
    d.input.finalUrl = 'javascript:alert(1)'
    const html = harness().api.render(d)
    expect(html).not.toContain('href="javascript:')
    expect(html).toContain('javascript:alert(1)')
  })

  it('highlights literal regex characters without altering or executing source text', () => {
    const { api } = harness()
    expect(api.mark('C++ (beta) a.b [x] $5 a|b {x} a-b', ['C++', '(beta)', 'a.b', '[x]', '$5', 'a|b', '{x}', 'a-b']))
      .toBe('<mark>C++</mark> <mark>(beta)</mark> <mark>a.b</mark> <mark>[x]</mark> <mark>$5</mark> <mark>a|b</mark> <mark>{x}</mark> <mark>a-b</mark>')
    expect(api.mark('<b>world-class</b> & class', ['world-class', 'class']))
      .toBe('&lt;b&gt;<mark>world-class</mark>&lt;/b&gt; &amp; <mark>class</mark>')
  })

  it('uses section references rather than recovering names from observation prose', () => {
    const { api } = harness()
    const d = report()
    const f = finding({ observation: '“Misleading prose title” appears here.' })
    expect(api.sectionName(f, d.sections)).toBe('Actual section heading')
    expect(api.sectionName({ ...f, affects: [] }, d.sections)).toBe('Actual section heading')
    expect(api.sectionName(f, [])).toBe('Section synthetic-section')
    expect(api.sectionName({ ...f, affects: [], evidence: [] }, [])).toBe('This page')
    expect(api.renderGroups([f], d.sections)).toContain('Actual section heading')
  })

  it('distinguishes structural observations without fabricating a source quote', () => {
    const html = harness().api.render(report({ findings: [finding({ evidence: [], affects: [] })] }))
    expect(html).toContain('Page-level structural check. There is no text passage to quote.')
    expect(html).not.toContain('<blockquote>')
  })

  it('filters mixed-priority occurrences without hiding valid findings', async () => {
    const d = report({ findings: [finding({ observation: 'High observation' }), finding({ id: 'second', priority: 'low', observation: 'Low observation' })] })
    const h = harness(d)
    await h.dispatch('submit', h.element('f'))
    await h.dispatch('click', h.element('chip-low'))
    expect(h.element('finding-list').innerHTML).toContain('Low observation')
    expect(h.element('finding-list').innerHTML).not.toContain('High observation')
    expect(h.element('chip-low').getAttribute('aria-pressed')).toBe('true')
    expect(h.element('chip-all').getAttribute('aria-pressed')).toBe('false')
    expect(h.api.findingsBody(d, 'medium')).toContain('Choose another priority')
  })
})

describe('multi-page reports', () => {
  it('sorts pages by fix-first counts then total findings', () => {
    const low = report({ findings: [finding({ priority: 'low' }), finding({ priority: 'low' })] })
    low.input.title = 'Many minor findings'
    const high = report(); high.input.title = 'Fix this first'
    const html = harness().api.renderSite([low, high], metadata(['https://a.test/', 'https://b.test/']), [], false)
    expect(html).toContain('<table class="tbl">')
    expect(html.indexOf('Fix this first')).toBeLessThan(html.indexOf('Many minor findings'))
  })

  it('lets a clean page expand to its own scope and limitations', async () => {
    const h = harness()
    const html = h.api.renderSite([report({ findings: [] })], metadata(), [], false)
    const control = html.match(/class="page-toggle" aria-expanded="false" aria-controls="([^"]+)"/)
    expect(control).not.toBeNull()
    const id = control?.[1] ?? ''
    expect(html).toContain('id="' + id + '" hidden')
    expect(html).toContain('Only this synthetic page was examined.')
    expect(html).toContain('No findings in the checks completed')
    const toggle = new StubElement(); toggle.classes.add('page-toggle'); toggle.setAttribute('aria-controls', id)
    h.element(id).hidden = true
    await h.dispatch('click', toggle)
    expect(h.element(id).hidden).toBe(false)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    await h.dispatch('click', toggle)
    expect(h.element(id).hidden).toBe(true)
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
  })

  it('retains failures, sitemap caps and model limitations alongside successful pages', () => {
    const d = report(); d.provider.degraded = true
    const meta = { ...metadata(['https://example.test/page', 'https://bad.test/']), totalFound: 30, truncated: true, sitemapUrl: 'https://example.test/sitemap.xml' }
    const html = harness().api.renderSite([d], meta, [{ url: 'https://bad.test/', error: { message: '<script>Failed</script>' } }], true)
    expect(html).toContain('In progress')
    expect(html).toContain('Selected 2 of 30 sitemap URLs (page limit reached).')
    expect(html).toContain('not the entire website')
    expect(html).toContain('1 pages have limited semantic coverage')
    expect(html).toContain('Partial report · decision model unavailable')
    expect(html).toContain('1 pages could not be analysed')
    expect(html).toContain('&lt;script&gt;Failed&lt;/script&gt;')
    expect(html).toContain('Presentation finding')
  })

  it('makes no claims about pages when every selected page fails', () => {
    const html = harness().api.renderSite([], metadata(), [{ url: 'https://example.test/page', error: { message: 'Failed presentation request' } }], false)
    expect(html).toContain('No page reports are available')
    expect(html).toContain('No conclusion can be drawn about these pages.')
    expect(html).not.toContain('No findings in the checks completed')
    expect(html).not.toContain('<table')
  })

  it('uses unique disclosure targets across page reports', () => {
    const html = harness().api.renderSite([report(), report()], metadata(['https://a.test/', 'https://b.test/']), [], false)
    const ids = Array.from(html.matchAll(/\bid="([^"]+)"/g), (match) => match[1])
    expect(new Set(ids).size).toBe(ids.length)
    for (const match of html.matchAll(/aria-controls="([^"]+)"/g)) expect(ids).toContain(match[1])
  })
})

describe('input modes and validation', () => {
  it('starts with only one accessible selected tab and disabled hidden required inputs', () => {
    expect(DASHBOARD_HTML.match(/role="tab" aria-selected="true"/g)).toHaveLength(1)
    expect(DASHBOARD_HTML.match(/role="tab" aria-selected="false"/g)).toHaveLength(2)
    for (const id of ['us', 'np', 'ul']) {
      const tag = DASHBOARD_HTML.match(new RegExp('<(?:input|textarea)\\b[^>]*\\bid="' + id + '"[^>]*>'))?.[0] ?? ''
      expect(tag, id).toContain('required disabled')
    }
    expect(DASHBOARD_HTML).toContain('role="tablist" aria-label="Audit scope"')
  })

  it('updates selection, focus and hidden-input validation for keyboard navigation', async () => {
    const h = harness()
    await h.dispatch('keydown', h.element('tab-page'), 'ArrowRight')
    expect(h.element('tab-site').getAttribute('aria-selected')).toBe('true')
    expect(h.element('tab-site').focused).toBe(true)
    expect(h.element('tab-site').tabIndex).toBe(0)
    expect(h.element('tab-page').tabIndex).toBe(-1)
    expect(h.element('pane-page').hidden).toBe(true)
    expect(h.element('u').disabled).toBe(true)
    expect(h.element('us').disabled).toBe(false)
    expect(h.element('ul').disabled).toBe(true)
    await h.dispatch('keydown', h.element('tab-site'), 'End')
    expect(h.element('ul').disabled).toBe(false)
    expect(h.element('us').disabled).toBe(true)
  })

  it('locks the selected scope during a run and restores only its controls', async () => {
    const h = harness()
    h.api.selectMode('site', false); h.api.setBusy(true)
    expect(h.tabs.every((tab) => tab.disabled)).toBe(true)
    expect(h.element('us').disabled).toBe(true)
    await h.dispatch('click', h.element('tab-list'))
    expect(h.element('tab-site').getAttribute('aria-selected')).toBe('true')
    h.api.setBusy(false)
    expect(h.element('us').disabled).toBe(false)
    expect(h.element('u').disabled).toBe(true)
    expect(h.element('ul').disabled).toBe(true)
  })

  it('normalizes and deduplicates URLs while preserving distinct pages', () => {
    const { api } = harness()
    expect(api.readUrls(' HTTPS://EXAMPLE.TEST\nhttps://example.test/\nhttps://example.test/a '))
      .toEqual(['https://example.test/', 'https://example.test/a'])
    expect(api.parseUrlList('')).toEqual([])
  })

  it('rejects invalid schemes and credentials without submitting', async () => {
    for (const value of ['not-a-url', 'javascript:alert(1)', 'https://user:secret@example.test/']) {
      const h = harness(); h.api.selectMode('list', false); h.element('ul').value = value
      await h.dispatch('submit', h.element('f'))
      expect(h.requests).toEqual([])
      expect(h.element('ul').validityMessage).toContain('without credentials')
      expect(h.element('ul').validityReported).toBe(true)
    }
  })

  it('rejects an oversized list visibly instead of silently submitting a truncated list', async () => {
    const h = harness(); h.api.selectMode('list', false)
    h.element('ul').value = Array.from({ length: 26 }, (_, index) => 'https://example.test/' + index).join('\n')
    await h.dispatch('submit', h.element('f'))
    expect(h.requests).toEqual([])
    expect(h.element('ul').validityMessage).toContain('No URLs have been submitted.')
    expect(h.element('ulcount').textContent).toBe('26 URLs · limit is 25')
    expect(h.api.parseUrlList(h.element('ul').value)).toHaveLength(25)
  })
})

describe('implemented check documentation', () => {
  it('keeps module and trust copy outside the horizontal heading rows', async () => {
    const headings: string[] = []
    const headingChildren: string[] = []
    const accordions = { modules: 0, trust: 0 }
    const html = renderChecksPage()
    const rewriter = new HTMLRewriter()
      .on('.section-heading > *', { element(element) { headingChildren.push(element.tagName) } })
      .on('section > .section-heading > h2', { text(chunk) { headings.push(chunk.text) } })
      .on('#modules > details.check > summary', { element() { accordions.modules++ } })
      .on('#trust > details.check > summary', { element() { accordions.trust++ } })
    await rewriter.transform(new Response(html)).text()
    expect(headingChildren.length).toBeGreaterThan(0)
    expect(headingChildren.every(tag => tag === 'h2' || tag === 'span')).toBe(true)
    // Counts come from the registry: the page said "two are built" while three were,
    // because this number was prose someone had to remember to update.
    expect(accordions).toEqual({
      modules: builtModules().length,
      trust: Object.keys(TEMPLATE_GROUPS.find((g) => g.id === 'trust')!.templates).length,
    })
    // Headings and anchors come from src/checks/registry.ts, so derive the expectation
    // from there rather than hardcoding strings that drift when a module is added.
    const text = headings.join(' ')
    for (const group of TEMPLATE_GROUPS) {
      expect(text, `heading missing: ${group.title}`).toContain(group.title.replace(/&/g, '&amp;'))
    }
    for (const id of ['modules', ...TEMPLATE_GROUPS.map((g) => g.id)]) {
      expect(html).toContain('<section id="' + id + '">')
      expect(html).toContain('href="#' + id + '"')
    }
  })

  it('documents exactly the implemented static, language and semantic catalogues', () => {
    const html = renderChecksPage()
    const rendered = Array.from(html.matchAll(/Check: <code>([^<]+)<\/code>/g), (match) => match[1]).sort()
    // Derived from src/checks/registry.ts, which is the single place a catalogue is
    // declared. Listing them here as well is what let eight checks ship undocumented.
    expect(rendered).toEqual(allCheckIds().sort())
    expect(html).not.toContain('planned, not yet built')
    expect(html).not.toContain('results come from the decision model alone')
    expect(html).toContain('These run even when the decision model is unavailable.')
  })

  it('includes every model question and its exact available answers', () => {
    const html = renderChecksPage()
    const rendered = Array.from(html.matchAll(/class="source">Question: <code>([^<]+)<\/code>/g), (match) => match[1]).sort()
    const questions = Object.fromEntries(
      QUESTION_GROUPS.flatMap((g) => Object.entries(g.catalogue)),
    )
    expect(rendered).toEqual(Object.keys(questions).sort())
    const escape = (value: string) => value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
    for (const question of Object.values(questions)) {
      expect(html).toContain(escape(question.instructions))
      for (const answer of Object.values(question.criteria)) expect(html).toContain(escape(answer))
    }
  })
})

describe('module 5 is visible on a single page, not only on a site scan', () => {
  const rows = [
    { id: 'q_what_it_costs', area: 'pricing', text: 'What does it cost?', status: 'unanswered', pages: ['https://example.test/page'] },
    { id: 'q_what_is_it', area: 'understanding', text: 'What is this, in plain terms?', status: 'answered', pages: ['https://example.test/page'] },
  ]

  it('shows the questions a single page raises and how it did', () => {
    // It used to emit a finding when a question was left hanging and nothing otherwise,
    // so a reader had no way to see which questions were even considered.
    const html = harness().api.render(report({ coverage: rows } as Partial<AnalysisResult>))
    expect(html).toContain('Questions buyers ask')
    expect(html).toContain('What does it cost?')
    expect(html).toContain('1 of 2 answered here')
  })

  it('does not name the page on every row of a single-page report', () => {
    const html = harness().api.render(report({ coverage: rows } as Partial<AnalysisResult>))
    expect(html).not.toContain('Raised on 1 page')
  })

  it('stays out of the way when the module produced nothing', () => {
    expect(harness().api.render(report())).not.toContain('Questions buyers ask')
  })
})

describe('the page table is still a table', () => {
  it('never makes a table row a grid', () => {
    // `.prow` was the page table's <tr> from the first commit; module 4's profile card
    // then took the same name for a grid row. `display:grid` on a <tr> stops it being a
    // row — the cells no longer line up with their headers — and nothing failed, because
    // no test looked at layout. Whatever classes land on a <tr>, none of them may carry
    // a display that replaces table layout.
    const css = DASHBOARD_HTML.match(/<style>([\s\S]*?)<\/style>/)?.[1] ?? ''
    const rowClasses = new Set<string>()
    for (const [, attr] of DASHBOARD_HTML.matchAll(/<tr class="([^"]+)"/g)) {
      for (const c of (attr ?? '').split(/\s+/)) rowClasses.add(c)
    }
    // The table is built in the client script, so look there too.
    for (const [, attr] of DASHBOARD_HTML.matchAll(/<tr class=\\?["']([^"'\\]+)/g)) {
      for (const c of (attr ?? '').split(/\s+/)) rowClasses.add(c)
    }
    expect(rowClasses.size, 'no table rows found — this test would pass vacuously')
      .toBeGreaterThan(0)

    for (const cls of rowClasses) {
      for (const [, body] of css.matchAll(new RegExp(`\\.${cls}\\s*\\{([^}]*)\\}`, 'g'))) {
        expect(body, `.${cls} is on a <tr> and sets a display that breaks the table`)
          .not.toMatch(/display\s*:\s*(grid|flex|block)/)
      }
    }
  })

  it('renders one cell per column in every row', () => {
    const html = harness().api.renderSite([report(), report()], metadata(), [], false)
    const headers = (html.match(/<th scope="col"/g) ?? []).length
    expect(headers).toBe(5)
    for (const [, row] of html.matchAll(/<tr class="prow">([\s\S]*?)<\/tr>/g)) {
      expect(((row ?? '').match(/<td/g) ?? []).length).toBe(headers)
    }
  })
})

describe('the report cards look like one another', () => {
  it('sets one heading size for every card', () => {
    // They were .86, .94, 1.0 and 1.02rem across four cards in the same report, which
    // is the kind of thing nobody can name but everybody notices.
    expect(DASHBOARD_HTML).toContain('.card h2 { font-size:.94rem')
    for (const stale of ['.limits h2 { font-size', '.profile h2 { font-size', '.table-title h2 { font-size']) {
      expect(DASHBOARD_HTML, `${stale} reintroduces a second heading size`).not.toContain(stale)
    }
  })

  it('names coverage areas the way the catalogue does', () => {
    // The client script cannot import from source, so the labels are copied. This is
    // what stops the copy drifting from the bank it describes.
    const script = DASHBOARD_HTML.match(/<script>([\s\S]*?)<\/script>/)?.[1] ?? ''
    const block = script.slice(script.indexOf('var COVERAGE_AREA_LABELS'))
    for (const key of Object.keys(COVERAGE_AREAS)) {
      expect(block.slice(0, block.indexOf('};')), `${key} is missing from the dashboard labels`)
        .toContain(`${key}:`)
    }
  })
})

describe('copy prompt', () => {
  const js = script

  it('builds a self-contained prompt from the finding', () => {
    const build = new Function(
      js.slice(js.indexOf('function buildPrompt')).split('\nfunction promptButton')[0] +
      '; return buildPrompt;',
    )()
    const prompt: string = build(
      {
        _page: 'https://e.com/pricing',
        observation: '“Pricing” sounds like an advert instead of giving facts.',
        whyItMatters: 'Words like “best” are not facts.',
        recommendedAction: 'Swap each for the fact behind it.',
        evidence: [{ quote: 'We offer world class plugins at the best rates.' }],
        highlights: ['world class', 'best'],
      },
      'https://e.com/',
    )
    expect(prompt).toContain('https://e.com/pricing')
    expect(prompt).toContain('We offer world class plugins at the best rates.')
    expect(prompt).toContain('world class, best')
    expect(prompt).toContain('Swap each for the fact behind it.')
  })

  it('forbids the receiving agent from inventing facts', () => {
    const build = new Function(
      js.slice(js.indexOf('function buildPrompt')).split('\nfunction promptButton')[0] +
      '; return buildPrompt;',
    )()
    const prompt: string = build(
      { observation: 'x', whyItMatters: 'y', recommendedAction: 'z', evidence: [], highlights: [] },
      'https://e.com/',
    )
    expect(prompt).toMatch(/do not invent/i)
    expect(prompt).toContain('[TODO: add figure]')
    expect(prompt).toMatch(/keep the original meaning/i)
  })

  it('uses one delegated click handler, not a competing second one', () => {
    // A second document-level listener silently replaced the first and broke
    // filtering and accordions.
    expect((js.match(/document\.addEventListener\('click'/g) ?? []).length).toBe(1)
    expect(js).toContain('handleCopyPrompt')
  })

  it('falls back when the clipboard API is unavailable', () => {
    expect(js).toContain('document.execCommand')
    expect(js).toContain("window.prompt('Copy this prompt:'")
  })
})

describe('bring-your-own API key', () => {
  const js = script

  it('offers a key field with save and remove controls', () => {
    expect(DASHBOARD_HTML).toContain('id="key-input"')
    expect(DASHBOARD_HTML).toContain('id="key-save"')
    expect(DASHBOARD_HTML).toContain('id="key-clear"')
    expect(DASHBOARD_HTML).toContain('type="password"')
  })

  it('uses localStorage, never a cookie', () => {
    // A cookie is attached to every request to this origin; the key belongs on
    // exactly one request.
    expect(js).toContain('localStorage')
    expect(js).not.toMatch(/document\.cookie/)
  })

  it('sends the key only on the analyse request, as a header', () => {
    expect(js).toContain("h['x-jev-key']")
    expect(js).toContain('analyzeHeaders()')
    // The sitemap call carries no credential.
    expect(js).toMatch(/fetch\('\/api\/sitemap[^)]*\)/)
  })

  it('never renders the key back in full', () => {
    const mask = new Function(
      js.slice(js.indexOf('function maskKey')).split('\nfunction renderKeyState')[0] +
      '; return maskKey;',
    )()
    const key = 'jevtok_abcdefghijklmnopqrstuvwxyz'
    const shown: string = mask(key)
    expect(shown).not.toBe(key)
    expect(shown).toContain('•')
    expect(shown.startsWith('jevt')).toBe(true)
    expect(mask('')).toBe('')
  })

  it('survives storage being unavailable instead of throwing', () => {
    // Private browsing and blocked site data make localStorage throw on access.
    expect(js).toMatch(/try\s*\{[^}]*localStorage/)
    expect(js).toContain('catch (err) { return ')
  })

  it('warns that the key is readable from this browser profile', () => {
    expect(DASHBOARD_HTML).toMatch(/shared machine|can read the key/i)
  })
})

describe('key requirement gate', () => {
  const js = script

  it('reads the requirement from a server-stamped meta tag, not a network probe', () => {
    expect(DASHBOARD_HTML).toContain('name="sc-requires-key" content="0"')
    expect(js).toContain('readNeedsKey')
    // A probe would race first paint and consume a request on every page load.
    expect(js).not.toContain("fetch('/health')")
  })

  it('blocks submission when a key is required but not saved', () => {
    // Gated only for the hosted provider — a self-hosted server usually needs no key.
    expect(js).toContain("loadSettings().provider === 'systemone'")
    expect(js).toContain('promptForKey(); return;')
    expect(js).toContain('Add your Jev API key to run an audit.')
  })

  it('still offers the deterministic-only path', () => {
    // The static layer works with no model at all; hiding that would be dishonest.
    expect(js).toContain("id=\"skip-key\"")
    expect(js).toContain('Run structure checks only, without a key')
    expect(js).toContain('skipKeyOnce = true')
  })

  it('uses classList.toggle only, which is what elements here implement', () => {
    expect(js).not.toMatch(/classList\.(add|remove)\(/)
  })
})

describe('decision model settings', () => {
  const js = script

  it('offers Jev, a self-hosted System One server, and Laya', () => {
    expect(DASHBOARD_HTML).toContain('value="systemone"')
    expect(DASHBOARD_HTML).toContain('value="systemone-self"')
    expect(DASHBOARD_HTML).toContain('value="laya"')
    expect(DASHBOARD_HTML).toContain('id="server-input"')
    expect(DASHBOARD_HTML).toContain('id="model-input"')
  })

  it('maps the self-hosted System One choice onto the same backend as Jev', () => {
    const headers = new Function(
      js.slice(js.indexOf('const SETTINGS_STORE')).split('\nconst PROVIDER_NOTES')[0] +
      `
      ;globalThis.localStorage = { getItem: (k) => k === 'siteclarity.settings'
        ? JSON.stringify({ provider: 'systemone-self', server: 'https://kev.example.com', model: 'kev-9b' })
        : null };
      ;function loadKey(){ return 'jevtok_' + 'x'.repeat(30) }
      ;return analyzeHeaders;`,
    )()
    const h = headers()
    // Kev and Decider share Jev's wire format; only the base URL differs.
    expect(h['x-sc-backend']).toBe('systemone')
    expect(h['x-sc-base-url']).toBe('https://kev.example.com')
    expect(h['x-sc-model']).toBe('kev-9b')
  })

  it('sends the laya backend when Laya is chosen', () => {
    const headers = new Function(
      js.slice(js.indexOf('const SETTINGS_STORE')).split('\nconst PROVIDER_NOTES')[0] +
      `
      ;globalThis.localStorage = { getItem: () => JSON.stringify({ provider: 'laya', server: 'https://laya.example.com', model: '' }) };
      ;function loadKey(){ return '' }
      ;return analyzeHeaders;`,
    )()
    const h = headers()
    expect(h['x-sc-backend']).toBe('laya')
    expect(h['x-sc-base-url']).toBe('https://laya.example.com')
    expect(h['x-sc-model']).toBeUndefined()
  })

  it('never sends a server URL for the hosted provider', () => {
    const headers = new Function(
      js.slice(js.indexOf('const SETTINGS_STORE')).split('\nconst PROVIDER_NOTES')[0] +
      `
      ;globalThis.localStorage = { getItem: () => JSON.stringify({ provider: 'systemone', server: 'https://stale.example.com', model: '' }) };
      ;function loadKey(){ return '' }
      ;return analyzeHeaders;`,
    )()
    expect(headers()['x-sc-base-url']).toBeUndefined()
  })

  it('warns that Laya has a much smaller context', () => {
    expect(js).toMatch(/smaller context/i)
  })
})

describe('export', () => {
  const js = script

  it('offers Markdown, HTML, JSON and the prompt bundle', () => {
    expect(js).toContain('data-x="md"')
    expect(js).toContain('data-x="html"')
    expect(js).toContain('data-x="json"')
    expect(js).toContain('data-x="prompts"')
  })

  it('builds exports in the browser, with no extra request', () => {
    expect(js).toContain('function exportMarkdown')
    expect(js).toContain('function exportHtml')
    expect(js).toContain('URL.createObjectURL')
    // An export endpoint would cost a round trip for data already in memory.
    expect(js).not.toMatch(/fetch\(['"]\/api\/export/)
  })

  it('tracks a context that survives a site scan clearing activeReport', () => {
    expect(js).toContain('exportCtx = { kind: \'site\'')
    expect(js).toContain('exportCtx = { kind: \'page\'')
    expect(js).toContain("if (!exportCtx || !exportCtx.reports.length)")
  })

  it('exports the unmodified API response as JSON so it stays diffable', () => {
    expect(js).toContain('JSON.stringify(exportCtx.kind === \'site\' ? exportCtx.reports : exportCtx.reports[0], null, 2)')
  })

  it('names files by host and audit date', () => {
    expect(js).toContain("'siteclarity-' + host + scope + '-' + day")
  })

  it('carries the limits block into the Markdown, not just the findings', () => {
    // A report without its scope statements would overstate what was checked.
    expect(js).toContain('What was and was not examined')
    expect(js).toContain('r.limits.statements')
  })
})

describe('loading animation', () => {
  const js = script

  it('shows the real pipeline stages, not a bare spinner', () => {
    expect(js).toContain('Fetching the page')
    expect(js).toContain('Reading structure')
    expect(js).toContain('Judging each section')
  })

  it('paces stages against measured durations', () => {
    // fetch ~500ms, extract ~10ms, jev ~395ms on a real page. The fast stages must be
    // visibly fast or a sub-second audit feels slow.
    const stages = new Function(
      js.slice(js.indexOf('const STAGES =')).split('\nlet stageTimer')[0] + '; return STAGES;',
    )()
    const fetchMs = stages.find((s: { id: string }) => s.id === 'fetch').ms
    const readMs = stages.find((s: { id: string }) => s.id === 'read').ms
    expect(readMs).toBeLessThan(fetchMs / 4)
    expect(stages.reduce((n: number, s: { ms: number }) => n + s.ms, 0)).toBeLessThan(1500)
  })

  it('never outlives the request', () => {
    // The bar holds short of the end and only completes when the response lands, so
    // the animation can finish early but never lag reality.
    expect(js).toContain('Math.min(92,')
    expect(js).toContain('function finishStages')
    expect(js).toContain("fill.style.width = '100%'")
  })

  it('cannot break an audit if the DOM is unlike a browser', () => {
    expect(js).toContain("typeof setInterval !== 'function'")
    expect(js).toMatch(/try \{ paint\(\); \} catch/)
  })

  it('stops the timer as soon as anything else renders', () => {
    expect(js).toContain("if (html.indexOf('progress-card') === -1) stopStages()")
  })

  it('reports the measured speed rather than claiming it', () => {
    expect(js).toContain('function speedLine')
    expect(js).toContain('judged in <strong>')
    expect(js).toContain('t.decideMs')
  })

  it('respects reduced motion', () => {
    expect(js).toContain('prefers-reduced-motion')
    expect(DASHBOARD_HTML).toContain('@media (prefers-reduced-motion: reduce)')
  })
})

describe('module attribution', () => {
  const js = script

  it('names the module each finding came from', () => {
    // Findings carried `module` from the start; the UI ignored it, so Module 2's
    // output was live but indistinguishable from Module 1's.
    expect(js).toContain('MODULE_LABELS')
    expect(js).toContain('Evidence & trust')
    expect(js).toContain('Answer readiness')
    expect(js).toContain('class="modtag"')
  })

  it('shows a per-module breakdown before anything is expanded', () => {
    expect(js).toContain('function moduleCounts')
    expect(js).toContain('function moduleStrip')
    expect(js).toContain('moduleStrip(d.findings)')
  })

  it('labels an unknown module rather than rendering undefined', () => {
    const src = js.slice(js.indexOf('const MODULE_LABELS'))
    const upToHelper = src.slice(0, src.indexOf('const moduleLabel') + src.slice(src.indexOf('const moduleLabel')).indexOf('\n'))
    const fn = new Function(upToHelper + '; return moduleLabel;')() as (id?: string) => string
    expect(fn('evidence_trust')).toBe('Evidence & trust')
    expect(fn('something_new')).toBe('Other')
    expect(fn(undefined)).toBe('Other')
  })

  it('documents every module 2 and 3 check as a tagged card, not prose', () => {
    // These eight were undocumented while the page described them in hand-written
    // bullets, which both drifts from the code and drops the priority tag every other
    // section carries.
    const page = renderChecksPage()
    for (const id of [
      ...Object.keys(EVIDENCE_TEMPLATES),
      ...Object.keys(MESSAGING_TEMPLATES),
      ...Object.keys(MESSAGING_JUDGED),
    ]) {
      expect(page, `${id} is not documented`).toContain(`Check: <code>${id}</code>`)
    }
  })

  it('gives every documented check a priority tag', () => {
    const page = renderChecksPage()
    const cards = page.split('Check: <code>').length - 1
    const tags = (page.match(/class="tag [a-z]+"/g) ?? []).length
    // One tag per card; a section rendered as prose would show up as a shortfall.
    expect(tags).toBeGreaterThanOrEqual(cards)
  })
})

describe('website understanding profile', () => {
  const js = script

  it('renders the page’s own sentence as a quotation, never a summary', () => {
    expect(js).toContain('function profileCard')
    expect(js).toContain('Your words')
    expect(js).toContain('<blockquote>')
    // The quote must come from the entry, not be rebuilt from anything.
    expect(js).toContain('esc(e.quote)')
  })

  it('shows a dimension the page does not state rather than hiding it', () => {
    // "You never say who this is for" is the most useful thing this module produces.
    expect(js).toContain('e.absentReason')
    expect(js).toContain('class="pval missing"')
  })

  it('renders nothing at all when the model did not run', () => {
    expect(js).toContain("if (!entries.length) return ''")
  })

  it('labels every dimension the contract defines', () => {
    const labels = new Function(
      js.slice(js.indexOf('const PROFILE_LABELS')).split('\nconst BUSINESS_TYPE_TEXT')[0] +
      '; return PROFILE_LABELS;',
    )() as Record<string, string>
    for (const d of ProfileDimension.options) {
      expect(labels[d], `${d} has no label in the UI`).toBeTruthy()
    }
  })
})

describe('stated focus input', () => {
  const js = script

  it('offers an optional focus field on the single-page pane', () => {
    expect(DASHBOARD_HTML).toContain('id="focus"')
    expect(DASHBOARD_HTML).toMatch(/What should this page say\?/)
    expect(DASHBOARD_HTML).toMatch(/optional/)
  })

  it('reads at most three usable lines', () => {
    const read = new Function(
      'const $ = (id) => globalThis.__el;' +
      js.slice(js.indexOf('function readFocus')).split('\nfunction analyzeHeaders')[0] +
      `; globalThis.__el = { value: [
        'We are built for agencies managing many client stores',
        'short',
        '   ',
        'We help stores reduce cart abandonment at checkout',
        'We offer WooCommerce plugins and themes for stores',
        'A fourth statement that should be dropped entirely',
      ].join(String.fromCharCode(10)) };
      return readFocus;`,
    )() as () => string[]
    const items = read()
    expect(items).toHaveLength(3)
    expect(items.some((t) => t === 'short')).toBe(false)
  })

  it('sends focus only for a single page, never for a site scan', () => {
    // Repeating the same statements against every page of a scan would report the
    // identical gap on all of them.
    expect(js).toContain('requestPage($(\'u\').value.trim(), readFocus())')
    expect(js).toContain('await requestPage(url)')
    expect(js).toContain('focus && focus.length ? { url, focus } : { url }')
  })

  it('omits the field entirely when nothing was typed', () => {
    const read = new Function(
      'const $ = (id) => globalThis.__el;' +
      js.slice(js.indexOf('function readFocus')).split('\nfunction analyzeHeaders')[0] +
      '; globalThis.__el = { value: "" }; return readFocus;',
    )() as () => string[]
    expect(read()).toEqual([])
  })
})

describe('site-wide findings reach the report', () => {
  const js = script

  it('calls the site endpoint once the pages are done', () => {
    // Three modules were unreachable because the scan never made this call.
    expect(js).toContain("fetch('/api/site'")
    expect(js).toContain('r.summary_for_site')
    expect(js).toContain('summaries: inventory')
  })

  it('does not call it below the minimum page count', () => {
    expect(js).toContain('inventory.length >= 3')
  })

  it('keeps the per-page report when the site call fails', () => {
    // A site-level failure must not lose work that already succeeded.
    expect(js).toMatch(/catch \(err\) \{[\s\S]{0,120}site = null/)
  })

  it('renders site findings with the same component as page findings', () => {
    // A site finding should read exactly like a page finding.
    expect(js).toContain('renderGroups(site.findings, [])')
    expect(js).toContain('moduleStrip(site.findings)')
  })

  it('places them above the page table and carries their limits', () => {
    // Asserted on the rendered order rather than on a source substring: the old version
    // matched the literal text `summaryCards(c) + siteBlock`, so inserting anything
    // between them failed the test without anything being wrong.
    const site = {
      findings: [finding({ id: 'site-f', checkId: 'audience_rarely_named', module: 'audience_coverage' })],
      signals: { pages: 3 },
      limits: ['Site-level checks read 3 page summaries, not the pages themselves.'],
      coverage: [],
      opportunities: [],
    }
    const html = (harness().api as unknown as {
      renderSite(r: AnalysisResult[], m: SitemapPresentation, f: FailurePresentation[], p: boolean, s: unknown): string
    }).renderSite([report()], metadata(), [], false, site)

    expect(html).toContain('Across the whole site')
    expect(html).toContain('Site-level checks read 3 page summaries, not the pages themselves.')
    expect(html.indexOf('Across the whole site')).toBeLessThan(html.indexOf('Choose a page to work on'))
  })
})
