#!/usr/bin/env node
/**
 * Live calibration of the decision layer.
 *
 * Deliberately NOT part of `npm test`: it needs a real key and spends real money, and
 * the offline suite must stay free. Run it explicitly:
 *
 *   npm run calibrate:live
 *
 * It reports per-question agreement against hand-written labels, and weights FALSE
 * POSITIVES separately because those are what make an audit tool feel untrustworthy —
 * a missed issue is disappointing, an invented one destroys confidence.
 *
 * Cases labelled `expect: null` are genuinely ambiguous. The model is scored correct
 * there only if it is NOT confident, so hedging on a hard case is rewarded rather than
 * punished.
 */
import { readFileSync } from 'node:fs'

const GLOBAL_THRESHOLD = 0.6

function loadEnv() {
  const cfg = {}
  try {
    for (const line of readFileSync('.dev.vars', 'utf8').split(/\r?\n/)) {
      const t = line.trim()
      if (!t || t.startsWith('#') || !t.includes('=')) continue
      const [k, ...v] = t.split('=')
      cfg[k.trim()] = v.join('=').trim()
    }
  } catch { /* fall through to process.env */ }
  return { ...cfg, ...process.env }
}

/**
 * Load a TypeScript module by transforming it properly rather than stripping types
 * with regexes — the regex approach broke on the first union type it met, and a
 * calibration harness that cannot parse its own corpus is worse than none.
 *
 * The catalogue and corpus are read from source so the calibration can never drift
 * from the questions that actually run.
 */
async function loadTs(path, exportName) {
  const { transformSync } = await import('esbuild')
  const js = transformSync(readFileSync(path, 'utf8'), {
    loader: 'ts',
    format: 'esm',
    target: 'node20',
  }).code
  const mod = await import(
    'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
  )
  return mod[exportName]
}

async function loadCatalogue() {
  const names = ['PAGE_QUESTIONS', 'SECTION_QUESTIONS', 'PASSAGE_QUESTIONS', 'EVIDENCE_QUESTIONS', 'MESSAGING_QUESTIONS']
  const parts = await Promise.all(names.map((n) => loadTs('src/semantic/questions.ts', n)))
  return Object.assign({}, ...parts)
}

const loadCases = () => loadTs('test/calibration/decisions.ts', 'DECISION_CASES')

/**
 * The reporting bar must be the SAME one the app uses, or this measures a pipeline
 * nobody runs. Loaded from source rather than re-typed.
 */
let thresholdFor = null
async function loadThresholds() {
  thresholdFor = await loadTs('src/semantic/thresholds.ts', 'thresholdFor')
}

async function ask(env, state, id, question) {
  const res = await fetch('https://api.typesafe.ai/v1/systemone', {
    method: 'POST',
    headers: {
      authorization: `Bearer ${env.JEV_API_KEY}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ state, model: env.DECISION_MODEL || 'jev-latest', questions: { [id]: question } }),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0, 160)}`)
  const json = await res.json()
  const a = json.answers?.[id]
  if (!a) throw new Error('no answer returned')
  // noul answers carry no confidence field; derive it the same way the app does.
  const confidence = a.confidence ?? (a.noul === undefined ? 0 : Math.min(1, Math.abs(a.noul - 0.5) * 2))
  return { ...a, confidence, usage: json.usage }
}

function verdict(c, a) {
  const confident = a.confidence >= thresholdFor(a, GLOBAL_THRESHOLD)
  if (c.expect === null) {
    return confident
      ? { ok: false, kind: 'overconfident', got: describe(a) }
      : { ok: true, kind: 'hedged', got: describe(a) }
  }
  if (!confident) return { ok: false, kind: 'underconfident', got: describe(a) }

  if (typeof c.expect === 'boolean') {
    const got = (a.noul ?? 0) >= 0.5
    return got === c.expect
      ? { ok: true, kind: 'match', got: describe(a) }
      : { ok: false, kind: c.expect === false ? 'false positive' : 'false negative', got: describe(a) }
  }
  if (typeof c.expect === 'string') {
    return a.choice === c.expect
      ? { ok: true, kind: 'match', got: describe(a) }
      : { ok: false, kind: 'wrong choice', got: describe(a) }
  }
  // Rubric index: allow one level of slack, since adjacent levels are a judgement call.
  const diff = Math.abs((a.score ?? 0) - c.expect)
  return diff <= 1
    ? { ok: true, kind: diff === 0 ? 'match' : 'within one level', got: describe(a) }
    : { ok: false, kind: `off by ${diff.toFixed(1)}`, got: describe(a) }
}

const describe = (a) =>
  a.noul !== undefined ? `noul ${a.noul.toFixed(2)}`
  : a.choice !== undefined ? `"${a.choice}"`
  : a.score !== undefined ? `score ${a.score.toFixed(2)}`
  : '?'

const bar = (n, total) => '█'.repeat(Math.round((n / Math.max(total, 1)) * 24)).padEnd(24, '·')

async function main() {
  const env = loadEnv()
  if (!env.JEV_API_KEY) {
    console.error('\nJEV_API_KEY is not set. Put it in .dev.vars, then run again.\n')
    process.exit(1)
  }

  await loadThresholds()
  const catalogue = await loadCatalogue()
  const cases = await loadCases()

  console.log(`\nLive calibration — ${cases.length} cases against ${env.DECISION_MODEL || 'jev-latest'}\n`)

  const rows = []
  let tokens = 0
  for (const c of cases) {
    const q = catalogue[c.question]
    if (!q) { console.log(`  SKIP ${c.id} — no such question in the catalogue`); continue }
    try {
      const a = await ask(env, c.state, c.question, q)
      tokens += a.usage?.input_tokens ?? 0
      const v = verdict(c, a)
      rows.push({ c, v })
      const flag = v.ok ? '  ok  ' : ' FAIL '
      const bar = thresholdFor(a, GLOBAL_THRESHOLD)
      console.log(`${flag}${c.id.padEnd(40)} ${v.got.padEnd(14)} conf ${a.confidence.toFixed(2)}/${bar.toFixed(2)}  ${v.kind}`)
      if (!v.ok) console.log(`        expected ${JSON.stringify(c.expect)} — ${c.why}`)
    } catch (e) {
      console.log(` ERR  ${c.id.padEnd(40)} ${e.message}`)
      rows.push({ c, v: { ok: false, kind: 'error', got: e.message } })
    }
  }

  const byQuestion = new Map()
  for (const { c, v } of rows) {
    const e = byQuestion.get(c.question) ?? { ok: 0, total: 0 }
    e.total++; if (v.ok) e.ok++
    byQuestion.set(c.question, e)
  }

  const ok = rows.filter((r) => r.v.ok).length
  const falsePos = rows.filter((r) => r.v.kind === 'false positive').length
  const overconf = rows.filter((r) => r.v.kind === 'overconfident').length

  console.log('\nPer question')
  for (const [q, e] of [...byQuestion].sort()) {
    console.log(`  ${q.padEnd(24)} ${bar(e.ok, e.total)} ${e.ok}/${e.total}`)
  }

  console.log(`\nAgreement        ${ok}/${rows.length}  (${Math.round((ok / rows.length) * 100)}%)`)
  console.log(`False positives  ${falsePos}   <- issues reported that are not real`)
  console.log(`Overconfident    ${overconf}   <- confident on a genuinely ambiguous case`)
  console.log(`Input tokens     ${tokens}\n`)

  if (falsePos > 0) {
    console.log('A false positive is the costly error here: it sends someone to fix')
    console.log('something that was never wrong. Tune the threshold or the question')
    console.log('wording before shipping a check that produces them.\n')
  }
  process.exit(rows.length && ok / rows.length >= 0.8 && falsePos === 0 ? 0 : 1)
}

main().catch((e) => { console.error(e); process.exit(1) })
