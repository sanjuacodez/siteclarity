# Architecture

How a URL becomes a report. Read `AGENTS.md` for the working rules and `docs/UI.md` before
touching the interface.

---

## The one-paragraph version

SiteClarity is a Cloudflare Worker with no database. A URL is fetched, parsed into
addressable passages with `HTMLRewriter`, checked by deterministic rules, and judged by a
**System One decision model** (Jev) that returns typed values and cannot write prose.
Findings are rendered from templates. Nothing is generated, so nothing can be hallucinated.

```
URL ─► intake ─► extract ─► ┌─ static checks (no model) ─┐
                            │                            ├─► findings ─► report
                            └─ decision layer (Jev) ─────┘
```

---

## Why there is no database

An audit is a one-shot pipeline: URL in, immutable report out. There is no user history to
query, no cross-audit aggregate, no shared mutable state. The result is returned to the
browser and rendered there.

That removes Postgres, pgvector, a job queue, an ORM, auth, and tenancy from the design. If
a future feature genuinely needs cross-audit queries — re-audit diffing, trend tracking —
that is the moment to add D1, not before.

## Why the browser drives multi-page scans

Cloudflare's free tier allows **10 ms of CPU per invocation**. Extraction costs roughly
0.02 ms per KB, so one 500 KB page is about 10 ms. Ten pages in a single request would be
~80 ms and fail outright with error 1101.

So a site scan is one `GET /api/sitemap` followed by one `POST /api/analyze` **per page**,
issued from the browser, three at a time. Each page gets its own invocation and its own
budget. Live progress is a free side effect.

---

## The pipeline

### 1. Intake — `src/intake/`

`normalize.ts` — scheme, host lowercasing, IDN, fragment stripping. **SSRF guards**: only
`http`/`https`; no IP literals in any encoding (decimal, octal, hex, IPv6-mapped); no
private, loopback, link-local or reserved hosts; no credentials in the authority.

`fetch.ts` — manual redirect following (`redirect: 'manual'`), re-validating **every hop**,
max 5. Content-type must be HTML. Body capped at 500 KB and streamed with a hard byte limit
so an oversized response is never fully buffered. Identifying user-agent. `robots.txt` is
honoured and **cached via the Workers Cache API** — without that, every page of a site scan
re-fetches it.

`sitemap.ts` — reads `Sitemap:` from `robots.txt`, then tries `/sitemap.xml` and
`/sitemap_index.xml`. Handles **sitemap indexes** by recursing one level into child
sitemaps. Filters to the same host, drops asset URLs, de-duplicates, caps.

### 2. Extraction — `src/extract/`

`HTMLRewriter` only. No `cheerio`, no `jsdom`, no DOM construction — it streams inside the
runtime and barely touches the CPU budget, where a DOM library would blow it.

- **Sections** — a heading plus everything up to the next heading of equal or higher level.
- **Passages** — paragraphs, list items, table cells, definition entries.
- **Passage IDs** — `s{n}:p{m}:{hash8}`, FNV-1a over normalised text. Deterministic and stable across re-runs; every finding in every future module points at one.
- **Page chrome is suppressed**: `nav`, `footer`, `aside`, `body > header`, and ARIA landmark roles. Note `body > header` and not bare `header` — an article title lives in `<header><h1>`, and suppressing all headers deleted it.
- **Boilerplate detection** — text appearing under **two or more different headings** is a byline, nav item or card blurb. Counting occurrences alone is wrong; a word can legitimately repeat inside one section. Crossing section boundaries is what gives boilerplate away.
- **Entity decoding** — `&#8217;` etc. Not cosmetic: a quote must match what a reader sees or the verification gate is meaningless.
- **JS-dependency signal** — rendered text versus script bytes.

### 3. Exclusions — `src/semantic/state.ts`

Content the site owner cannot act on is removed **before** analysis, not down-ranked
afterwards. Unactionable findings are what this product exists not to produce.

- **Testimonials** — two-pass. Seed on the reviewer's voice (`I`, `my`, dominant over `we`, `our`), then expand across adjacent review-shaped sections. Voice alone missed about a third of them ("Fair price, fantastic support" has no pronoun at all); adjacency alone would catch legitimate short sections. Together they are precise.
- **Link cards / related posts** — sections whose content is entirely boilerplate.
- **Thin sections** — below `MIN_SECTION_WORDS`, and capped at `MAX_SECTIONS` largest.

Every exclusion is disclosed in `limits.statements`.

### 4. Static layer — `src/static/` — **no model**

Runs always, including when the decision backend is unreachable. This is what makes the
free-tier claim real: useful output with no key and no cost.

- `structure/checks.ts` — JSON-LD validity and type, FAQ markup, heading hierarchy, list/table presence, over-long passages, `noindex`/`noai`, canonical, title, meta description, JS-dependency.
- `language/signals.ts` — anaphora load, vague quantifiers, sentence length. English-gated: other languages return nothing rather than applying English lexicons.
- `lexicons/hype.ts` — a committed, reviewed superlative list grouped by what the word does. Also supplies `highlights`.

### 5. Decision layer — `src/semantic/` + `src/provider/`

**Scope-partitioned state.** Jev has a 32k context, but chunking a page is the wrong answer —
fragile at boundaries and useless for multi-page work. Instead each question gets the
smallest state that can answer it:

| Scope | Contents | Typical |
| --- | --- | --- |
| Page | title, meta, heading tree, opening text | 2–4k tokens |
| Section | one section + heading + one-line page anchor | 200–800 tokens |
| Passage | one claim + its heading | ~100 tokens |

Every state fits, so truncation never happens. It is also **more correct**: "is this section
understandable in isolation?" is a question about the section alone, and feeding it the
surrounding page corrupts the answer.

Measured: whole-page state 13,050 tokens versus largest scoped state **293**.

**The general principle — decisions are local, aggregation is deterministic code.** Never put
many pages in one state; roll up in TypeScript.

### 6. Assembly — `src/assemble/`

- `verify.ts` — the **quote verification gate**. Every quote must be a verbatim substring of a stored passage. Normalisation is narrow (whitespace + NFC) on purpose; loose normalisation is how fabricated evidence slips through. Zero tolerance: a failing finding is dropped, never repaired.
- `checks.ts` — maps a decision crossing a threshold to a finding template.
- `suggest.ts` — tailored advice without generation (see below).
- `findings.ts` — assembles, verifies, de-duplicates overlapping checks and repeated evidence, orders by extraction impact.

---

## How suggestions are specific without a generative model

Jev returns only schema values — it **cannot write a sentence**, and that limitation is what
makes its output trustworthy. Specificity comes from two other places:

1. **The offending words are extracted deterministically** from the hype lexicon, so advice names them: *"this section leans on 'world-class' and 'unmatched'"* rather than "replace each superlative".
2. **The model picks which kind of fix applies** — an `improvement_type` Choice question (`add_a_number`, `cite_evidence`, `state_the_limit`, `give_an_example`, `define_the_term`) — and the pre-written template for that choice is rendered.

One section gets "point at the proof", another "add a figure", because the model judged them
differently. Nothing is generated.

---

## The decision model, and swapping it

Jev, **Kev** and **Decider** all speak TypeSafe's `POST /v1/systemone` wire format, so
switching is a base-URL change. **Laya** has its own interface, translated behind the adapter.

```
POST https://api.typesafe.ai/v1/systemone
{ "state": {...}, "model": "jev-latest", "questions": { "id": { "type": "noul", ... } } }
```

Three primitives: **Noul** (is this true → 0–1), **Choice** (pick one → value +
probabilities + confidence), **Score** (rubric → probability-weighted index + legend).
All questions in a call are evaluated in parallel against the same state.

Two shape facts only a live call revealed:

- **`noul` answers carry no `confidence` field.** The value *is* the signal: 0.96 is a confident yes, 0.5 maximal uncertainty. We derive `|value − 0.5| × 2` so one threshold works across all three primitives. The schema originally required `confidence` and would have rejected every yes/no answer.
- **`score` is a 0-based probability-weighted index over the rubric**, not a rating. `0.48` against five levels sits between level 0 and level 1. It is not "48%" and must never be rendered as one.

Backends: `workersai` (Jev via the `AI` binding, no key — the default), `systemone` (Jev API,
Kev, Decider), `replay` (recorded fixtures, the default in tests).

---

## Performance

Measured on a real page:

| Stage | Cost |
| --- | --- |
| fetch | 500–800 ms |
| extract | ~20 ms (≈0.02 ms/KB) |
| decide | 700–900 ms, ~30 calls at concurrency 14 |

A direct Jev call: **1 question 876 ms, 4 questions 941 ms.** Questions are nearly free;
**calls** are what cost. The largest remaining optimisation is batching several sections into
one call (~30 → ~6), not asking fewer questions — but it weakens the self-containment
question, which depends on the model seeing one section alone.

## Configuration

`wrangler.jsonc` vars, overridable in `.dev.vars` locally:

| Var | Default | Purpose |
| --- | --- | --- |
| `DECISION_BACKEND` | `workersai` | `workersai` \| `systemone` \| `replay` |
| `DECISION_MODEL` | `jev-latest` | model id, never hardcoded in source |
| `MAX_PAGE_BYTES` | `500000` | 10 ms CPU ≈ 500 KB |
| `MAX_SECTIONS` | `40` | largest sections analysed |
| `MIN_SECTION_WORDS` | `12` | below this a section is skipped |
| `MAX_CONCURRENT_DECISIONS` | `14` | parallel calls per page |
| `CONFIDENCE_THRESHOLD` | `0.6` | below this → `cannot_assess` |
| `STATE_TOKEN_BUDGET` | `24000` | headroom under Jev's 32k |

Secrets (`.dev.vars`, or `wrangler secret put`): `JEV_API_KEY`, `SYSTEMONE_BASE_URL`. Both
optional — the default backend needs neither.

`wrangler.test.jsonc` exists because the `ai` binding forces a remote proxy session
requiring Cloudflare auth, which would break offline testing. It omits that binding and uses
the `replay` backend.
