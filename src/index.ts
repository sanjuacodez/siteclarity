import { Hono } from 'hono'
import { loadConfig, withCallerKey, readCallerKey, type AppEnv } from './lib/config'
import { AppError, statusFor } from './lib/errors'
import { logger } from './lib/logger'
import { normalizeUrl } from './intake/normalize'
import { fetchPage } from './intake/fetch'
import { discoverUrls } from './intake/sitemap'
import { extract } from './extract/extract'
import { createBackend } from './provider'
import {
  detectTestimonialSections,
  detectLinkCardSections,
  excludedSections,
  buildPageState,
  buildSectionStates,
  buildPassageStates,
  selectClaimCandidates,
} from './semantic/state'
import { PAGE_QUESTIONS, SECTION_QUESTIONS, PASSAGE_QUESTIONS } from './semantic/questions'
import { runDecisions, isConfident } from './semantic/run'
import { SCHEMA_VERSION, assertNoOverallScore, type Decision } from './contracts'
import {
  assembleFindings,
  assembleStaticFindings,
  summarize,
  type DecisionSource,
} from './assemble/findings'
import { compareByImpact, countOccurrences } from './assemble/impact'
import { DASHBOARD_HTML } from './ui/dashboard'
import { renderChecksPage } from './ui/checks'

const app = new Hono<{ Bindings: AppEnv }>()

app.get('/', (c) => {
  const config = loadConfig(c.env)
  // Tell the page up front whether this deployment has any credentials of its own.
  // Stamping it here avoids a client-side probe and is correct on first paint.
  const requiresKey = !config.jevApiKey && !c.env.AI
  return c.html(
    requiresKey
      ? DASHBOARD_HTML.replace('name="sc-requires-key" content="0"', 'name="sc-requires-key" content="1"')
      : DASHBOARD_HTML,
  )
})

app.get('/checks', (c) => c.html(renderChecksPage()))

app.get('/health', (c) => {
  const config = loadConfig(c.env)
  return c.json({
    ok: true,
    version: SCHEMA_VERSION,
    backend: config.backend,
    model: config.model,
    aiBindingPresent: Boolean(c.env.AI),
    jevKeyPresent: Boolean(config.jevApiKey),
    // True when this deployment has no server-side credentials and expects visitors
    // to supply their own key from the browser.
    requiresCallerKey: !config.jevApiKey && !c.env.AI,
  })
})

app.get('/api/sitemap', async (c) => {
  const config = loadConfig(c.env)
  const raw = c.req.query('url')
  if (!raw) return c.json({ error: { code: 'invalid_url', message: 'Missing "url"' } }, 400)

  const normalized = normalizeUrl(raw)
  if (!normalized.ok) return c.json(normalized.error.toJSON(), statusFor(normalized.error.code) as 400)

  const limit = Math.min(Number(c.req.query('limit') ?? '10') || 10, 25)
  const found = await discoverUrls(normalized.value.url, config, limit)
  if (!found.ok) return c.json(found.error.toJSON(), statusFor(found.error.code) as 400)

  logger.info('sitemap discovered', {
    site: normalized.value.href,
    found: found.value.totalFound,
    returning: found.value.urls.length,
  })
  return c.json(found.value)
})

app.post('/api/analyze', async (c) => {
  const started = Date.now()
  // Bring-your-own-key: a visitor's own Jev key, supplied per request and used only
  // for this request. Never stored, never logged (see redactSecrets).
  const callerKey = readCallerKey(c.req.header('x-jev-key') ?? null)
  const config = withCallerKey(loadConfig(c.env), callerKey)

  const body = await c.req.json<{ url?: string }>().catch(() => ({}) as { url?: string })
  if (!body.url) {
    return c.json({ error: { code: 'invalid_url', message: 'Body must include "url"' } }, 400)
  }

  const normalized = normalizeUrl(body.url)
  if (!normalized.ok) {
    return c.json(normalized.error.toJSON(), statusFor(normalized.error.code) as 400)
  }

  const fetched = await fetchPage(normalized.value.url, config)
  if (!fetched.ok) {
    return c.json(fetched.error.toJSON(), statusFor(fetched.error.code) as 400)
  }
  if (!fetched.value.robotsAllowed) {
    return c.json(
      new AppError('robots_disallowed', fetched.value.robotsReason ?? 'Disallowed').toJSON(),
      403,
    )
  }

  const tExtract = Date.now()
  const doc = await extract(fetched.value.html, fetched.value.finalUrl)
  const extractMs = Date.now() - tExtract

  // Scope-partitioned states — every one fits the budget, so truncation never happens.
  const perStateBudget = Math.floor(config.stateTokenBudget / 4)
  const pageState = buildPageState(doc, fetched.value.finalUrl)
  const sectionStates = buildSectionStates(doc, perStateBudget, {
    minWords: config.minSectionWords,
    maxSections: config.maxSections,
  })
  const testimonialSections = detectTestimonialSections(doc)
  const linkCardSections = detectLinkCardSections(doc)
  const allExcluded = excludedSections(doc)
  const substantiveTotal = doc.sections.filter(
    (s) => s.passageIds.length > 0 && !allExcluded.has(s.id),
  ).length
  const claimCandidates = selectClaimCandidates(doc)
  const passageStates = buildPassageStates(doc, claimCandidates)

  const backend = createBackend(c.env, config)
  const tDecide = Date.now()

  const [pageRun, sectionRun, passageRun] = await Promise.all([
    runDecisions(backend, [pageState], PAGE_QUESTIONS, 1),
    runDecisions(backend, sectionStates, SECTION_QUESTIONS, config.maxConcurrentDecisions),
    runDecisions(backend, passageStates, PASSAGE_QUESTIONS, config.maxConcurrentDecisions),
  ])
  const decideMs = Date.now() - tDecide

  const degraded = pageRun.stats.degraded || sectionRun.stats.degraded || passageRun.stats.degraded
  const degradedReason =
    pageRun.stats.degradedReason ?? sectionRun.stats.degradedReason ?? passageRun.stats.degradedReason

  const toDecision = (a: (typeof sectionRun.outcomes)[number]['answers'][string]): Decision | null => {
    if (!isConfident(a, config.confidenceThreshold)) return null
    if (a.type === 'noul') return { kind: 'noul', value: a.noul ?? 0, confidence: a.confidence }
    if (a.type === 'choice')
      return { kind: 'choice', value: a.choice ?? '', probabilities: a.probabilities, confidence: a.confidence }
    return { kind: 'score', value: a.score ?? 0, legend: a.legend, probabilities: a.probabilities, confidence: a.confidence }
  }

  const collect = (answers: Record<string, (typeof sectionRun.outcomes)[number]['answers'][string]>) => {
    const out: Record<string, Decision> = {}
    for (const [id, a] of Object.entries(answers)) {
      const d = toDecision(a)
      if (d) out[id] = d
    }
    return out
  }

  const sources: DecisionSource[] = []

  const pageOutcome = pageRun.outcomes[0]
  if (pageOutcome) {
    sources.push({
      scope: 'page',
      refId: 'page',
      label: doc.title ?? 'this page',
      passageIds: doc.passages.slice(0, 2).map((p) => p.id),
      decisions: collect(pageOutcome.answers),
    })
  }

  const sections = doc.sections.map((s) => {
    const outcome = sectionRun.outcomes.find((o) => o.refId === s.id || o.refId.startsWith(`${s.id}#`))
    const decisions = outcome ? collect(outcome.answers) : {}
    if (outcome && Object.keys(decisions).length > 0) {
      sources.push({
        scope: 'section',
        refId: s.id,
        label: s.heading ?? '',
        heading: s.heading,
        passageIds: s.passageIds,
        decisions,
      })
    }
    return {
      sectionId: s.id,
      heading: s.heading,
      level: s.level,
      passageCount: s.passageIds.length,
      decisions,
    }
  })

  for (const outcome of passageRun.outcomes) {
    const decisions = collect(outcome.answers)
    if (Object.keys(decisions).length === 0) continue
    const passage = doc.passagesById.get(outcome.refId)
    if (!passage) continue
    // Only ask about specificity where the model agreed there is a claim.
    const isClaim = decisions.is_claim
    if (isClaim && isClaim.kind === 'noul' && isClaim.value < 0.5) continue
    const parentSection = sectionRun.outcomes.find(
      (o) => o.refId === passage.sectionId || o.refId.startsWith(`${passage.sectionId}#`),
    )
    if (parentSection) {
      const parentDecisions = collect(parentSection.answers)
      if (parentDecisions.improvement_type) {
        decisions.improvement_type = parentDecisions.improvement_type
      }
    }
    sources.push({
      scope: 'passage',
      refId: outcome.refId,
      label: doc.sections.find((x) => x.id === passage.sectionId)?.heading ?? '',
      passageIds: [outcome.refId],
      decisions,
    })
  }

  // Deterministic findings run regardless of whether the decision model was reachable.
  const staticFindings = assembleStaticFindings(doc, fetched.value.finalUrl)
  const decisionFindings = assembleFindings(doc, sources, fetched.value.finalUrl)
  // Ordered by extraction impact — how much of the page stops being usable if this is
  // not fixed — rather than by priority label. See assemble/impact.ts.
  const merged = [...staticFindings, ...decisionFindings]
  const occurrences = countOccurrences(merged)
  const findings = merged.sort((a, b) => compareByImpact(a, b, occurrences))

  const stateSplit = sectionStates.some((s) => s.refId.includes('#'))
  const langSupported = !doc.lang || doc.lang.toLowerCase().startsWith('en')

  const result = {
    schemaVersion: SCHEMA_VERSION,
    input: {
      requestedUrl: fetched.value.requestedUrl,
      finalUrl: fetched.value.finalUrl,
      fetchedAt: fetched.value.fetchedAt,
      title: doc.title,
    },
    limits: {
      scope: 'single_page' as const,
      statements: buildLimitStatements({
        degraded,
        degradedReason,
        needsKey: !config.jevApiKey && !c.env.AI,
        stateSplit,
        langSupported,
        lang: doc.lang,
        jsDependent: doc.jsDependency.likely,
        sectionsAnalyzed: sectionStates.length,
        sectionsTotal: substantiveTotal,
        testimonialSections: testimonialSections.size,
        linkCardSections: linkCardSections.size,
        truncated: fetched.value.truncated,
        bytesRead: fetched.value.bytes,
        totalBytes: fetched.value.totalBytes,
      }),
      decisionsRan: !degraded && sectionRun.outcomes.length > 0,
      sectionsAnalyzed: sectionRun.outcomes.length,
      sectionsTotal: substantiveTotal,
      stateSplit,
      language: doc.lang,
      languageSupported: langSupported,
      jsDependent: doc.jsDependency.likely,
    },
    sections,
    findings,
    provider: {
      backend: degraded ? ('none' as const) : backend.name,
      model: pageRun.stats.model ?? sectionRun.stats.model,
      calls: pageRun.stats.calls + sectionRun.stats.calls + passageRun.stats.calls,
      inputTokens:
        pageRun.stats.inputTokens + sectionRun.stats.inputTokens + passageRun.stats.inputTokens,
      outputTokens:
        pageRun.stats.outputTokens + sectionRun.stats.outputTokens + passageRun.stats.outputTokens,
      degraded,
      degradedReason,
    },
    timings: { totalMs: Date.now() - started, extractMs, decideMs },
    // Diagnostics for the spike; SC-111 replaces this with assembled findings.
    summary: summarize(findings),
    _debug: {
      passages: doc.passages.length,
      sectionStates: sectionStates.length,
      claimCandidates: claimCandidates.length,
      pageStateTokens: pageState.estimatedTokens,
      maxSectionStateTokens: Math.max(0, ...sectionStates.map((s) => s.estimatedTokens)),
      totalStateTokens:
        pageState.estimatedTokens +
        sectionStates.reduce((n, s) => n + s.estimatedTokens, 0) +
        passageStates.reduce((n, s) => n + s.estimatedTokens, 0),
    },
  }

  assertNoOverallScore({ ...result, _debug: undefined })
  logger.info('analysis complete', {
    url: result.input.finalUrl,
    findings: findings.length,
    calls: result.provider.calls,
    ms: result.timings.totalMs,
  })

  return c.json(result)
})

function buildLimitStatements(ctx: {
  degraded: boolean
  degradedReason: string | null
  needsKey: boolean
  stateSplit: boolean
  langSupported: boolean
  lang: string | null
  jsDependent: boolean
  sectionsAnalyzed: number
  sectionsTotal: number
  testimonialSections: number
  linkCardSections: number
  truncated: boolean
  bytesRead: number
  totalBytes: number | null
}): string[] {
  const out = [
    'Only the single page you submitted was analysed. This is not an assessment of the whole site.',
  ]
  if (ctx.degraded) {
    // Say what the reader can do about it. "AI binding not configured" is true but
    // useless to someone who just wants a full report.
    out.push(
      ctx.needsKey
        ? 'No API key was supplied, so only the structural checks ran. Add your Jev API key to also check whether each section actually answers its heading, reads on its own, and avoids empty marketing language.'
        : `The decision model could not be reached (${ctx.degradedReason ?? 'unknown reason'}), so only the structural checks ran. The meaning-based findings are missing from this report.`,
    )
  }
  if (ctx.stateSplit) {
    out.push('Some sections were long enough to be split across several evaluations.')
  }
  if (!ctx.langSupported) {
    out.push(
      `The page declares language "${ctx.lang}". Language-specific checks are English-only and were not applied.`,
    )
  }
  if (ctx.testimonialSections > 0) {
    out.push(
      `${ctx.testimonialSections} ${ctx.testimonialSections === 1 ? 'section looks' : 'sections look'} like customer reviews or testimonials and ${ctx.testimonialSections === 1 ? 'was' : 'were'} skipped — they are not content you can rewrite.`,
    )
  }
  if (ctx.truncated) {
    out.push(
      `This page is larger than we can process in one pass, so only the first ${Math.round(ctx.bytesRead / 1000)} KB were analysed${ctx.totalBytes ? ` of about ${Math.round(ctx.totalBytes / 1000)} KB` : ''}. Anything further down the page was not looked at.`,
    )
  }
  if (ctx.linkCardSections > 0) {
    out.push(
      `${ctx.linkCardSections} ${ctx.linkCardSections === 1 ? 'block was' : 'blocks were'} skipped as link cards or related-post lists — their text repeats across the page, so they are navigation rather than content.`,
    )
  }
  if (ctx.sectionsAnalyzed < ctx.sectionsTotal) {
    out.push(
      `Of ${ctx.sectionsTotal} sections with content, the ${ctx.sectionsAnalyzed} largest were evaluated. Short sections such as navigation blocks and card grids were skipped.`,
    )
  }
  if (ctx.jsDependent) {
    out.push(
      'This page appears to render its content with JavaScript, so the served HTML analysed here may differ from what a visitor sees.',
    )
  }
  return out
}

export default app
