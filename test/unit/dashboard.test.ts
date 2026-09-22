import { describe, it, expect } from 'vitest'
import { DASHBOARD_HTML } from '../../src/ui/dashboard'
import { renderChecksPage } from '../../src/ui/checks'
import type { AnalysisResult, Finding } from '../../src/contracts'
import { CHECKS } from '../../src/assemble/checks'
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
  it('documents exactly the implemented static, language and semantic catalogues', () => {
    const html = renderChecksPage()
    const rendered = Array.from(html.matchAll(/Check: <code>([^<]+)<\/code>/g), (match) => match[1]).sort()
    expect(rendered).toEqual([...Object.keys(STATIC_TEMPLATES), ...Object.keys(LANGUAGE_TEMPLATES), ...CHECKS.map((check) => check.id)].sort())
    expect(html).not.toContain('planned, not yet built')
    expect(html).not.toContain('results come from the decision model alone')
    expect(html).toContain('These run even when the decision model is unavailable.')
  })

  it('includes every model question and its exact available answers', () => {
    const html = renderChecksPage()
    const rendered = Array.from(html.matchAll(/class="source">Question: <code>([^<]+)<\/code>/g), (match) => match[1]).sort()
    const questions = { ...PAGE_QUESTIONS, ...SECTION_QUESTIONS, ...PASSAGE_QUESTIONS }
    expect(rendered).toEqual(Object.keys(questions).sort())
    const escape = (value: string) => value.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] ?? c)
    for (const question of Object.values(questions)) {
      expect(html).toContain(escape(question.instructions))
      for (const answer of Object.values(question.criteria)) expect(html).toContain(escape(answer))
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
    expect(js).toContain('if (needsKey && !loadKey() && !skipKeyOnce) { promptForKey(); return; }')
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
