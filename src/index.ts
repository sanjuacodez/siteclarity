import { Hono } from 'hono'
import {
  loadConfig,
  withCallerSettings,
  readCallerKey,
  readCallerBackend,
  readCallerModel,
  type AppEnv,
} from './lib/config'
import { AppError, statusFor } from './lib/errors'
import { logger } from './lib/logger'
import { normalizeUrl, validateBackendUrl } from './intake/normalize'
import { fetchPage } from './intake/fetch'
import { discoverUrls } from './intake/sitemap'
import { extract } from './extract/extract'
import { createBackend } from './provider'
import { findClaims } from './static/evidence/markers'
import { analyseCtas } from './static/messaging/cta'
import { EVIDENCE_TEMPLATES } from './static/evidence/templates'
import {
  readFocusItems,
  shortlistForFocus,
  buildFocusQuestions,
  buildFocusState,
  FOCUS_NOT_FOUND,
  FOCUS_TEMPLATE,
} from './semantic/focus'
import {
  shortlistPassages,
  buildProfileQuestions,
  buildProfileState,
  ABSENT_REASONS,
  NOT_STATED,
} from './semantic/profile'
import { ProfileDimension, type ProfileEntry } from './contracts'
import { buildPageSummary } from './semantic/inventory'
import {
  readSiteSignals,
  buildSiteState,
  SITE_QUESTIONS,
  SITE_TEMPLATES,
  SITE_AUDIENCE_TEMPLATES,
  MIN_PAGES,
  SELL_HEAVY,
} from './semantic/site'
import { PageSummary, type Finding } from './contracts'
import type { StaticTemplate } from './static/structure/templates'
import { z } from 'zod'

/** Fill a template's {slots}. Shared by the site route. */
function fillSlots(text: string, slots: Record<string, string | number>): string {
  return text.replace(/\{(\w+)\}/g, (m, k: string) => (k in slots ? String(slots[k]) : m))
}
import { MESSAGING_JUDGED } from './static/messaging/templates'
import { makeEvidence, verifyAll } from './assemble/verify'
import {
  buildClaimEvidenceStates,
  detectTestimonialSections,
  detectLinkCardSections,
  excludedSections,
  buildPageState,
  buildSectionStates,
  buildPassageStates,
  selectClaimCandidates,
} from './semantic/state'
import {
  PAGE_QUESTIONS,
  SECTION_QUESTIONS,
  PASSAGE_QUESTIONS,
  EVIDENCE_QUESTIONS,
  MESSAGING_QUESTIONS,
} from './semantic/questions'
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

/**
 * Site-level analysis over an inventory of page summaries.
 *
 * The browser accumulates summaries as it scans and posts them here once. There is no
 * storage: the inventory lives in the tab exactly as the report does, which is what lets
 * the whole design stay database-free.
 */
app.post('/api/site', async (c) => {
  const started = Date.now()
  const callerKey = readCallerKey(c.req.header('x-jev-key') ?? null)
  const config = withCallerSettings(loadConfig(c.env), {
    key: callerKey,
    backend: readCallerBackend(c.req.header('x-sc-backend') ?? null),
    baseUrl: null,
    model: readCallerModel(c.req.header('x-sc-model') ?? null),
  })

  const body = await c.req
    .json<{ summaries?: unknown }>()
    .catch(() => ({}) as { summaries?: unknown })
  const parsed = z.array(PageSummary).max(25).safeParse(body.summaries)
  if (!parsed.success) {
    return c.json(
      new AppError('internal', 'Expected an array of page summaries').toJSON(),
      400,
    )
  }
  const summaries = parsed.data
  if (summaries.length < MIN_PAGES) {
    return c.json({
      findings: [],
      signals: readSiteSignals(summaries),
      limits: [
        `Site-level checks need at least ${MIN_PAGES} pages; ${summaries.length} were scanned.`,
      ],
      timings: { totalMs: Date.now() - started },
    })
  }

  const signals = readSiteSignals(summaries)
  const findings: Finding[] = []
  const pageUrl = summaries[0]!.url

  const add = (checkId: string, tpl: StaticTemplate, slots: Record<string, string | number>) => {
    findings.push({
      id: `${checkId}:site`,
      module: 'audience_coverage',
      checkId,
      observation: fillSlots(tpl.observation, slots),
      evidence: [],
      whyItMatters: tpl.whyItMatters,
      recommendedAction: tpl.recommendedAction,
      affects: summaries.map((s) => ({ pageUrl: s.url })),
      priority: tpl.priority,
      confidence: 'high',
      highlights: [],
      copySource: 'template',
    })
  }

  // Deterministic: counting what every page was already judged on individually.
  if (signals.audienceNamed < signals.pages / 2) {
    add('audience_rarely_named', SITE_TEMPLATES.audience_rarely_named!, {
      named: signals.audienceNamed,
      pages: signals.pages,
    })
  }
  if (signals.withoutAction > signals.pages / 2) {
    add('site_has_no_next_step', SITE_TEMPLATES.site_has_no_next_step!, {
      count: signals.withoutAction,
      pages: signals.pages,
    })
  }
  const sell = signals.purposes.sell ?? 0
  const explain = signals.purposes.explain ?? 0
  if (sell / signals.pages > SELL_HEAVY && explain === 0) {
    add('site_sells_without_explaining', SITE_TEMPLATES.site_sells_without_explaining!, {
      sell,
      explain,
      pages: signals.pages,
    })
  }

  // The one judgement worth a model: whether the pages cohere around an audience.
  const backend = createBackend(c.env, config)
  const siteRun = await runDecisions(
    backend,
    [
      {
        scope: 'page' as const,
        refId: 'site',
        state: buildSiteState(summaries),
        estimatedTokens: 0,
        meta: {},
      },
    ],
    SITE_QUESTIONS,
    1,
  )

  const answer = siteRun.outcomes[0]?.answers.site_audience_consistency
  if (answer && isConfident(answer, config.confidenceThreshold)) {
    const choice = String(answer.choice ?? '')
    const tpl =
      choice === 'drifting'
        ? SITE_AUDIENCE_TEMPLATES.audience_drifts
        : choice === 'none_evident'
          ? SITE_AUDIENCE_TEMPLATES.audience_none_evident
          : null
    if (tpl) add(choice === 'drifting' ? 'audience_drifts' : 'audience_none_evident', tpl, {})
  }

  logger.info('site analysis complete', { pages: signals.pages, findings: findings.length })
  return c.json({
    findings,
    signals,
    limits: [
      `Site-level checks read ${signals.pages} page summaries, not the pages themselves.`,
      ...(siteRun.stats.degraded
        ? ['The decision model was unavailable, so only the counted checks ran.']
        : []),
    ],
    provider: { calls: siteRun.stats.calls, degraded: siteRun.stats.degraded },
    timings: { totalMs: Date.now() - started },
  })
})

app.post('/api/analyze', async (c) => {
  const started = Date.now()
  // Bring-your-own model settings, supplied per request by the visitor's browser and
  // used only for this request. Never stored, never logged (see redactSecrets).
  const base = loadConfig(c.env)
  const rawBaseUrl = (c.req.header('x-sc-base-url') ?? '').trim()

  let callerBaseUrl: string | null = null
  if (rawBaseUrl) {
    // The caller chooses which host we POST to, so this is a real SSRF vector on a
    // hosted instance and gets the same host rules as page fetching.
    const checked = validateBackendUrl(rawBaseUrl, base.allowPrivateBackend)
    if (!checked.ok) return c.json(checked.error.toJSON(), statusFor(checked.error.code) as 400)
    callerBaseUrl = checked.value
  }

  const config = withCallerSettings(base, {
    key: readCallerKey(c.req.header('x-jev-key') ?? null),
    backend: readCallerBackend(c.req.header('x-sc-backend') ?? null),
    baseUrl: callerBaseUrl,
    model: readCallerModel(c.req.header('x-sc-model') ?? null),
  })

  const body = await c.req
    .json<{ url?: string; focus?: unknown }>()
    .catch(() => ({}) as { url?: string; focus?: unknown })
  // Optional: what the owner says the page is about. URL-only onboarding stays true.
  const focusItems = readFocusItems(body.focus)
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

  // Module 2: only claims whose evidence sits in a DIFFERENT passage need judging —
  // proximity is already measured, relevance is not.
  const claims = findClaims(doc, allExcluded)
  const claimStates = buildClaimEvidenceStates(doc, claims)

  // Module 4: the model selects which of the page's own sentences states each
  // dimension. It never writes one.
  const profileCandidates = shortlistPassages(doc, allExcluded)
  const profileStates = profileCandidates.length
    ? [buildProfileState(doc, fetched.value.finalUrl, profileCandidates)]
    : []
  const profileQuestions = buildProfileQuestions(profileCandidates)

  // Stated intent, checked against what the page says. Shares the profile shortlist
  // shape so the state budget is unchanged.
  const focusCandidates = focusItems.length ? shortlistForFocus(doc, allExcluded) : []
  const focusStates = focusCandidates.length
    ? [buildFocusState(doc, fetched.value.finalUrl, focusCandidates)]
    : []
  const focusQuestions = buildFocusQuestions(focusItems, focusCandidates)

  const backend = createBackend(c.env, config)
  const tDecide = Date.now()

  const [pageRun, sectionRun, passageRun, claimRun, profileRun, focusRun] = await Promise.all([
    // Module 3's dimensions are properties of the whole page's argument, so they ride
    // with the page state rather than needing a call of their own.
    runDecisions(backend, [pageState], { ...PAGE_QUESTIONS, ...MESSAGING_QUESTIONS }, 1),
    runDecisions(backend, sectionStates, SECTION_QUESTIONS, config.maxConcurrentDecisions),
    runDecisions(backend, passageStates, PASSAGE_QUESTIONS, config.maxConcurrentDecisions),
    runDecisions(backend, claimStates, EVIDENCE_QUESTIONS, config.maxConcurrentDecisions),
    runDecisions(backend, profileStates, profileQuestions, 1),
    runDecisions(backend, focusStates, focusQuestions, 1),
  ])
  const decideMs = Date.now() - tDecide

  const degraded =
    pageRun.stats.degraded || sectionRun.stats.degraded || passageRun.stats.degraded ||
    claimRun.stats.degraded || profileRun.stats.degraded || focusRun.stats.degraded
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
  // A nearby fact that does not support its claim is worse than no fact: the page looks
  // evidenced when it is not. Reportable only once the model has judged relevance.
  const irrelevant: typeof merged = []
  for (const outcome of claimRun.outcomes) {
    const answer = outcome.answers.evidence_supports_claim
    if (!answer || !isConfident(answer, config.confidenceThreshold)) continue
    if ((answer.noul ?? 1) >= 0.5) continue // it does support the claim

    const claim = claims.find((c) => c.passage.id === outcome.refId)
    if (!claim) continue
    const tpl = EVIDENCE_TEMPLATES.evidence_irrelevant!
    const ev = verifyAll(
      doc,
      [makeEvidence(doc, claim.passage.id)].filter((e): e is NonNullable<typeof e> => e !== null),
    )
    if (ev.length === 0) continue

    irrelevant.push({
      id: `evidence_irrelevant:${claim.passage.id}`,
      module: 'evidence_trust',
      checkId: 'evidence_irrelevant',
      observation: tpl.observation.replace('{what}', claim.what),
      evidence: ev,
      whyItMatters: tpl.whyItMatters,
      recommendedAction: tpl.recommendedAction.replace('{what}', claim.what),
      affects: [{ pageUrl: fetched.value.finalUrl, sectionId: claim.passage.sectionId }],
      priority: tpl.priority,
      confidence: answer.confidence >= 0.85 ? 'high' : 'medium',
      // Only highlight words visible in the quote shown (see assemble/findings.ts).
      highlights: claim.terms.filter((t) =>
        ev.map((e) => e.quote).join(' ').toLowerCase().includes(t.toLowerCase()),
      ),
      copySource: 'template',
    })
  }

  // Module 3, judged half. A false answer is the finding; a true one means nothing to say.
  const messaging: typeof merged = []
  const MESSAGING_MAP: Record<string, string> = {
    states_the_problem: 'no_problem_stated',
    names_the_audience: 'audience_not_named',
    states_differentiation: 'no_differentiation',
  }
  if (pageOutcome) {
    for (const [question, checkId] of Object.entries(MESSAGING_MAP)) {
      const answer = pageOutcome.answers[question]
      if (!answer || !isConfident(answer, config.confidenceThreshold)) continue
      if ((answer.noul ?? 1) >= 0.5) continue

      const tpl = MESSAGING_JUDGED[checkId]!
      messaging.push({
        id: `${checkId}:page`,
        module: 'messaging',
        checkId,
        observation: tpl.observation,
        evidence: [],
        whyItMatters: tpl.whyItMatters,
        recommendedAction: tpl.recommendedAction,
        affects: [{ pageUrl: fetched.value.finalUrl }],
        priority: tpl.priority,
        confidence: answer.confidence >= 0.85 ? 'high' : 'medium',
        highlights: [],
        copySource: 'template',
      })
    }
  }

  /**
   * A stated focus the page does not communicate. The gap between what someone believes
   * their page says and what it says is the most useful thing here — and it is invisible
   * to them precisely because they already know it.
   */
  const focusFindings: typeof merged = []
  const focusOutcome = focusRun.outcomes[0]
  if (focusOutcome) {
    for (const item of focusItems) {
      const answer = focusOutcome.answers[item.id]
      if (!answer || !isConfident(answer, config.confidenceThreshold)) continue
      if (String(answer.choice ?? '') !== FOCUS_NOT_FOUND) continue

      focusFindings.push({
        id: `focus_not_communicated:${item.id}`,
        module: 'website_understanding',
        checkId: 'focus_not_communicated',
        observation: FOCUS_TEMPLATE.observation.replace('{focus}', item.text),
        evidence: [],
        whyItMatters: FOCUS_TEMPLATE.whyItMatters,
        recommendedAction: FOCUS_TEMPLATE.recommendedAction,
        affects: [{ pageUrl: fetched.value.finalUrl }],
        priority: FOCUS_TEMPLATE.priority,
        confidence: answer.confidence >= 0.85 ? 'high' : 'medium',
        highlights: [],
        copySource: 'template',
      })
    }
  }

  const withEvidence = [...merged, ...irrelevant, ...messaging, ...focusFindings]
  const findings = withEvidence.sort((a, b) =>
    compareByImpact(a, b, countOccurrences(withEvidence)),
  )

  /**
   * Module 4's profile. Every quote is looked up from the passage store by the id the
   * model chose, so the reader sees the page's own words and nothing is authored here.
   */
  /** Read a confident Choice, or null. Used to fill the page summary. */
  const readChoice = (a: (typeof pageRun.outcomes)[number]['answers'][string] | undefined) =>
    a && isConfident(a, config.confidenceThreshold) ? (a.choice ?? null) : null
  const readNoul = (a: (typeof pageRun.outcomes)[number]['answers'][string] | undefined) =>
    a && isConfident(a, config.confidenceThreshold) ? (a.noul ?? 0) >= 0.5 : null
  const ctasForSummary = analyseCtas(doc)

  const profile: ProfileEntry[] = []
  const profileOutcome = profileRun.outcomes[0]
  if (profileOutcome) {
    for (const dimension of ProfileDimension.options) {
      const answer = profileOutcome.answers[dimension]
      const absent: ProfileEntry = {
        dimension,
        value: null,
        quote: null,
        passageId: null,
        sectionId: null,
        absentReason: ABSENT_REASONS[dimension],
        confidence: null,
      }
      if (!answer || !isConfident(answer, config.confidenceThreshold)) {
        profile.push(absent)
        continue
      }
      const choice = String(answer.choice ?? '')
      if (!choice || choice === NOT_STATED) {
        profile.push(absent)
        continue
      }
      const band = answer.confidence >= 0.85 ? 'high' : answer.confidence >= 0.65 ? 'medium' : 'low'

      // business_type is a taxonomy answer, not a passage reference.
      if (dimension === 'business_type') {
        profile.push({ ...absent, value: choice, absentReason: null, confidence: band })
        continue
      }

      const index = Number(/^p(\d+)$/.exec(choice)?.[1] ?? '0') - 1
      const passage = profileCandidates[index]
      if (!passage) {
        // The model named an option that does not exist. Report absence rather than
        // guessing which passage it meant.
        profile.push(absent)
        continue
      }
      profile.push({
        dimension,
        value: null,
        quote: passage.text,
        passageId: passage.id,
        sectionId: passage.sectionId,
        absentReason: null,
        confidence: band,
      })
    }
  }

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
    profile,
    // This page reduced to typed values, so the browser can accumulate an inventory for
    // the site-level pass. Six of its seven fields are already computed above.
    summary_for_site: buildPageSummary({
      doc,
      url: fetched.value.finalUrl,
      purpose: readChoice(pageOutcome?.answers.purpose_clarity),
      businessType: profile.find((e) => e.dimension === 'business_type')?.value ?? null,
      audienceNamed: readNoul(pageOutcome?.answers.names_the_audience),
      hasAction: ctasForSummary.actions.length > 0,
      count: findings.length,
      high: findings.filter((f) => f.priority === 'high').length,
    }),
    provider: {
      backend: degraded ? ('none' as const) : backend.name,
      model: pageRun.stats.model ?? sectionRun.stats.model,
      calls:
        pageRun.stats.calls + sectionRun.stats.calls + passageRun.stats.calls +
        claimRun.stats.calls,
      inputTokens:
        pageRun.stats.inputTokens + sectionRun.stats.inputTokens +
        passageRun.stats.inputTokens + claimRun.stats.inputTokens,
      outputTokens:
        pageRun.stats.outputTokens + sectionRun.stats.outputTokens +
        passageRun.stats.outputTokens + claimRun.stats.outputTokens,
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
