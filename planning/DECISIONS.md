# SiteClarity — planning decisions

Status: **planning complete for Module 1.** Revision 4. Nothing built or deployed.
Tasks: `tasks/INDEX.md` (SC-101..SC-115, all TODO). Agent rules: `AGENTS.md`.
License: **MIT** (resolved 2026-09-22).
Date: 2026-09-22. Working name: SiteClarity (availability unassessed).
Model: free and open source, self-hosted, **Cloudflare free tier only**.
Source of product intent: `docs/website-marketing-intelligence-use-cases-benefits.md`.

## Revision 3 — what changed

Revision 2 planned one product. The use-cases document describes a **ten-module platform**.
Revision 3 accepts that scale as the destination but refuses to build toward it in one pass.

1. **Build one module at a time.** Each module ships standalone and useful on its own.
2. **Cloudflare free tier only.** No Workers Paid, no service requiring a card on file.
3. **Module 1 is AI / Answer Readiness.** Reasoning below.

## Revision 4 — SiteClarity is a System One application

Revisions 1–3 treated "Jev" as an unverified name and planned around a generative LLM. That
was wrong. **Jev is real** — TypeSafe AI's System One model, released 2026-09-15 (v1.13 on
09-18), after this plan's research cutoff. Correcting it does not cost the plan; it improves
it, and the task DAG survives intact. Only SC-105, SC-108 and SC-109 change materially.

### What a System One model is

Jev evaluates a **state** against **typed questions** and returns decisions software can act
on directly. It does not generate text. Three primitives:

| Primitive | Asks | Returns |
| --- | --- | --- |
| **Choice** | pick one option from a list | `choice`, `probabilities`, `confidence` |
| **Score** | rate the state on a rubric | `score`, `probabilities`, `confidence` |
| **Noul** | is this statement true? | a value in 0–1 |

Every question is evaluated **in parallel and in isolation against the same state in one
request**. There is no memory; state is supplied per call. Roughly $0.0004 per case and
~0.4 s, against $0.03–0.18 and 10–38 s for a comparable generative LLM.

### Why SiteClarity is an unusually good fit

This is not an LLM product that happens to use Jev. Its semantic work **is** high-volume
repeated bounded decisions over a shared state where the answers are known up front —
Jev's stated design target.

1. **The page is the state. The readiness dimensions are the questions.** One page state, dozens of typed questions, one parallel call.
2. **Every judgment is already an enum or a rubric.** The `CoverageLabel` frozen in revision 1 (`answered | partial | conflicting | not_found_in_scope | cannot_assess`) is literally a Choice question. Nothing in this product needs free text.
3. **Invariant 1 becomes structural.** Jev returns only schema-defined values, so it *cannot* author a quote. "Evidence is never model-authored" stops being a property we test for and becomes one the architecture guarantees. The SC-110 gate stays as defence in depth, not as the primary control.
4. **`confidence` and `probabilities` give `cannot_assess` a principled trigger** — a calibrated number below threshold, rather than a heuristic or a model's self-report.
5. **Cost makes the destination reachable.** The use-cases document's ambition of analysing hundreds of pages is not viable per-page through a generative model. At $0.0004 a case it is.

### The consequence: no generative model anywhere

Findings come from a **fixed catalogue of checks**, so `observation`, `whyItMatters` and
`recommendedAction` are **templates** with slots filled from deterministic extraction and
typed decisions. The pipeline is:

```
deterministic extraction  →  typed decisions  →  templated findings
   HTMLRewriter               Choice/Score/Noul     no generated prose
   passages + stable IDs      parallel, one call    deterministic, testable
```

Zero generated text means zero hallucination surface, deterministic output, unit-testable
copy, and trivial translation later. This is only possible *because* a System One model
handles the semantic judgment.

### And it scales to the other nine modules

Buyer-journey stage, audience addressed, coverage label, messaging dimension — these are all
**Choice questions over the same page state**. The marginal cost of module N is mostly *more
questions in the same call*, not more pipeline. That materially reduces the risk of the
ten-module destination.

### Model portability — Jev, Kev, Laya

**Jev, Kev and Decider share TypeSafe's wire format (`POST /v1/systemone`)**, so switching
between them is a base-URL change. Laya uses its own interface and needs a thin adapter.

| Model | License | Runs | Interface |
| --- | --- | --- | --- |
| **Jev** (TypeSafe) | Proprietary, hosted | Workers AI as `typesafe/jev`, or TypeSafe API | System One |
| **Kev** (jaredpalmer) | Self-hosted, Qwen3.5-based, 0.8B/4B/9B | Own GPU | System One |
| **Decider** | Apache-2.0, 2B | Local GPU | System One |
| **Laya** (Convai) | Apache-2.0, ModernBERT-large ~421M | Local GPU (T4-class) | Independent |

Default is **Jev via the Workers AI binding** — no API key, covered by the free allowance.
Self-hosters wanting full local control point at Kev, Decider or Laya.

### The 32k state budget, and how it is solved

Jev 1.13 has a 32,000-token context. Chunking a long page across calls is the obvious answer
and the wrong one — it is fragile at boundaries and does not scale to the multi-page modules
at all.

**Solution: scope-partitioned state.** Almost every question here is section- or
passage-scoped, not page-scoped. Each question receives exactly the state it needs:

| Scope | Contents | Typical size |
| --- | --- | --- |
| Page | title, meta, heading tree, section index, first section | 2–4k tokens |
| Section | one section + heading + one-line page anchor | 200–800 tokens |
| Passage | one claim + its section heading | ~100 tokens |

Every state fits comfortably, so **truncation never happens**. It is also more *correct*:
"is this section understandable in isolation?" is a question about the section alone, and
feeding it the surrounding page corrupts the answer.

The cost is more calls (a 30-section page → ~31), which is cheap: issued concurrently at
~0.4 s each, ~0 CPU (network wait), roughly a cent per page.

**The general principle — decisions are local, aggregation is deterministic code.** Per-page
decisions use page-scope states; roll-ups happen in TypeScript; genuinely cross-page
questions use a compact summary state (one line per page — 100 pages ≈ 5k tokens). This is
what makes a 500-page audit reachable from a 32k-context model, and it is why the ten-module
destination is not blocked by context size.

## The destination

From the use-cases document, the long-term structure is:

```
Company → Products/Services → Audiences → Problems → Buyer Journey
        → Topics → Questions → Pages → Sections → Marketing Opportunities
```

Ten modules sit on that spine: Website Understanding, Product Portfolio Intelligence,
Messaging Intelligence, Buyer Journey Analysis, Customer Question Coverage, Content
Opportunity Discovery, Content Overlap & Cannibalization, Audience Coverage, Evidence &
Trust, and AI / Answer Readiness.

The primary output is never a score. It is the answer to: *what should the marketing team
work on next?*

## Build order, and why

Modules are ordered by **how little they depend on** — single-page and standalone first,
crawl-dependent later, the aggregator last.

| # | Module | Needs a crawl? | Needs an LLM? | Order |
| --- | --- | --- | --- | --- |
| 10 | AI / Answer Readiness | No | Partly | **1st** |
| 9 | Evidence & Trust | No | Partly | 2nd |
| 3 | Messaging Intelligence | No | Yes | 3rd |
| 1 | Website Understanding | Optional | Yes | 4th |
| 5 | Customer Question Coverage | Yes | Yes | 5th |
| 4 | Buyer Journey Analysis | Yes | Yes | 6th |
| 8 | Audience Coverage | Yes | Yes | 7th |
| 2 | Product Portfolio Intelligence | Yes | Yes | 8th |
| 7 | Content Overlap / Cannibalization | Yes | Embeddings | 9th |
| 6 | Content Opportunity Discovery | — | Aggregates all | **last** |

**Why AI Readiness first:** it is the only module that needs no crawl, no business profile,
and no question generation — so it has zero upstream dependencies. Critically, roughly half
of its dimensions are **fully deterministic** (schema markup, heading structure, list/table
presence, paragraph length, hype-word density). That means v0.1 produces genuine value with
**zero LLM calls, no API key, and no per-run cost**, which is exactly the right shape for a
free, self-hosted, open-source tool. It is also the easiest module to test honestly.

**Why Content Opportunity Discovery is last:** it consumes the output of every other module.
Building it early would mean building it twice.

## The decision that makes modules compose: one Finding contract

Every module emits findings in the same shape, fixed now, in module 1:

```ts
type Finding = {
  id: string
  module: ModuleId
  observation: string       // what is true
  evidence: EvidenceRef[]   // passage IDs — never a model-authored string
  whyItMatters: string
  recommendedAction: string
  affects: { pageUrl: string; sectionId?: string }[]
  priority: 'high' | 'medium' | 'low'
  confidence: 'high' | 'medium' | 'low'
}
```

This is lifted directly from the use-cases document's opportunity structure. Locking it in
module 1 is what lets module 6 aggregate later instead of forcing a rewrite of all nine.

## Free-tier architecture

Verified 2026-09-22 — re-check before relying on any of it.

| Service | Free allowance | Used for |
| --- | --- | --- |
| Workers | 100k req/day, **10 ms CPU/invocation**, 50 external subrequests/invocation | API + analysis |
| Workflows | Available on Free; 3-day retention, **100 MB state/instance** | Multi-step runs (module 4+) |
| Workers AI | **10,000 neurons/day**; includes `typesafe/jev` | Default decision model |
| Pages | Static hosting, generous | UI + report viewer |
| KV | 1 GB, 100k reads/day, **1,000 writes/day** | Optional share links |
| **R2** | 10 GB — but **reportedly requires a card on file** | **Avoided** |

### The three constraints that shape every design choice

**1. 10 ms CPU per invocation.** This is the binding constraint, not memory and not requests.
Time awaiting `fetch` does not count, so network-bound work is fine; *your JavaScript* must
stay under 10 ms. Consequences:

- Decompose work into many small Workflow steps — each step is its own invocation, so the CPU budget resets per step.
- Parse HTML with **HTMLRewriter** (streaming, in-runtime) rather than building a DOM.
- **No in-memory vector search.** Revision 2 proposed cosine similarity over thousands of vectors in a Worker; at 10 ms that is not viable. Module 7 will need a different approach (chunked comparison across steps, or Vectorize) — a problem deferred to 9th place, not solved now.
- Avoid parsing large JSON blobs inside a step.

**2. Jev via the Workers AI binding is the default — no API key required.** `typesafe/jev`
is in the Workers AI catalogue, so the free daily neuron allowance covers it. Clone, deploy,
run, pay nothing. Per-call neuron cost is unverified and is a spike item. Fallbacks if it
proves too costly: the TypeSafe API directly, or self-hosted Kev/Decider/Laya.

**3. No R2, so no card.** Since R2 appears to require a payment method even at zero spend,
v0.1 stores nothing server-side: the report is returned to the browser and downloaded as
JSON, Markdown, or HTML. A shareable link is an *optional* KV-backed extra (1,000 writes/day
is ample). Statelessness is a feature here, not a compromise — nothing to leak, nothing to
retain, nothing to explain in a privacy policy.

### Shape

```
Pages (static UI)  ──POST /api/analyze──►  Worker (Hono)
                                              │
                                              ├─ fetch page (network wait, no CPU cost)
                                              ├─ HTMLRewriter → sections + passage IDs
                                              ├─ static checks (deterministic, no LLM)
                                              ├─ semantic checks (Workers AI, optional)
                                              └─ Finding[] ──► browser (download / optional KV link)
```

Module 1 needs no Workflow at all — a single page analysis fits one request. Workflows enter
at module 4, when crawling begins.

## Module 1 — AI / Answer Readiness

**Question it answers:** *can a search or AI system find, understand, and extract the answers
this page contains?*

Two layers. The static layer runs always; the semantic layer is optional.

### Static layer — deterministic, no LLM, no key, no cost

| Check | Signal |
| --- | --- |
| Structured data | JSON-LD present, parseable, type-appropriate; FAQ/HowTo/Product markup |
| Heading hierarchy | Single H1, no skipped levels, descriptive not decorative |
| Question-shaped headings | Headings phrased as user questions |
| Answer proximity | Does substantive text directly follow each heading |
| Extractable formats | Lists, tables, definition blocks vs. walls of prose |
| Passage length | Paragraphs within an extractable range |
| Specificity proxy | Density of numbers, dates, named entities, units |
| Hype density | Superlative/marketing lexicon per 100 words ("best", "leading", "revolutionary") |
| Anaphora load | Unresolved pronouns and "it/this/that" openers — proxy for non-self-contained text |
| Content availability | Is meaningful text in the served HTML or injected by JS |
| Machine access | robots.txt, meta robots, canonical, noai/noimageai signals |

### Decision layer — Jev, typed questions over one state

The page's extracted representation is the **state**. All questions go in **one parallel
call**:

| Question | Primitive |
| --- | --- |
| "This section directly answers the question in its heading." | Noul |
| "This section is understandable in isolation." | Noul |
| "The primary entity is named unambiguously, not only as 'we'/'our platform'." | Noul |
| "This passage makes a checkable claim." | Noul |
| Specificity of this claim (vague → checkable) | Score |
| Promotional intensity | Score |
| Extraction-readiness verdict for this section | Choice |

Returned `confidence` below a documented threshold yields `cannot_assess` — never a guess.
Because Jev emits only schema values, no step here can produce prose or a quote.

### Output

A `Finding[]` per the shared contract, plus a per-section readiness breakdown. **No overall
score.** Findings are ordered by how much they block extraction.

### Non-negotiable rules carried forward

- Quotes are pulled from stored passage IDs. A model never authors a quote string.
- Labels: `answered` / `partial` / `conflicting` / `not_found_in_scope` / `cannot_assess`. Applicability is a separate field from the label.
- Page content is untrusted input. A page instructing the model to rate it highly must not be able to move a result.
- No rank, grade, citation probability, search volume, or traffic estimate — ever.
- Never describe a single-page analysis as a site assessment.

## QA plan

**Tier 1 — deterministic, offline, every commit.** The entire static layer is unit-testable
against frozen HTML fixtures with hand-checked expected output. URL normalization, SSRF
guards, HTMLRewriter extraction, passage-ID stability, hype lexicon, schema parsing, Finding
schema validation. Because module 1 is roughly half deterministic, Tier 1 covers roughly half
the product — an unusually strong position for a first module.

**Tier 2 — recorded Workers AI responses, every commit.** Replay is the default so
contributors run the full pipeline offline and free. Live calls require an explicit flag.

**Tier 3 — live calibration, manual.** 15–20 hand-labelled real pages, committed as HTML
snapshots so results stay reproducible as the live sites change.

**Quote-verification gate.** Every quote must be a verbatim substring of a stored passage.
Deterministic, free, zero tolerance, hard build failure. This is the cheapest high-value test
in the plan: it converts the core promise from an intention into an enforced invariant.

**CPU budget test.** Assert each handler stays under 10 ms CPU against the largest fixture.
On the free tier this is a correctness test, not a performance nicety — exceeding it returns
error 1101 rather than degrading.

**Ship gate for module 1:** quote verification 100%, Tier 1 and 2 green, CPU budget met on
the largest fixture, and the static layer produces useful findings with the LLM disabled.

## Open decisions

1. ~~**License**~~ — **RESOLVED 2026-09-22: MIT.** Chosen for adoption and simplicity, accepted as provisional. Note the constraint: relicensing is practical only while the project is single-contributor, and versions already published under MIT remain MIT permanently.
2. **Product name** — availability unchecked (npm, domain, trademark).
3. **R2 card requirement** — sources conflict. If it turns out no card is needed, R2 becomes the better artifact store and the stateless design becomes a choice rather than a workaround.
4. **Jev neuron cost on Workers AI** — unverified. Determines whether the free tier sustains realistic use, and whether self-hosted Kev/Laya becomes the recommended default instead.
5. ~~**State chunking strategy**~~ — **RESOLVED: scope-partitioned state.** See above. Chunking is not used.

## Tasks — module 1 only

Later modules are not scheduled until module 1 ships.

```
SC-101  Repository, license, CI, contributor setup (replay-mode tests, no key needed)
SC-102  Worker shell: Hono routing, config, bindings, local dev            → 101
SC-103  URL intake: normalization, scope rules, SSRF guards, size caps     → 102
SC-104  Fetch + HTMLRewriter extraction → sections and stable passage IDs  → 103
SC-105  Finding contract + schema validation (the cross-module contract)   → 102
SC-106  Static layer: structure, schema, headings, extractability          → 104, 105
SC-107  Static layer: language signals — hype, specificity, anaphora       → 104, 105
SC-108  Provider adapter: Workers AI default, OpenAI-compatible option     → 102
SC-109  Semantic layer: bounded section judgments                          → 106, 108
SC-110  Quote-verification gate                                            → 109
SC-111  Finding assembly, prioritization, honest limits block              → 107, 110
SC-112  Report UI, JSON/Markdown/HTML export, optional KV share link       → 111
SC-113  Fixture corpus and calibration harness                             → 110
SC-114  CPU budget test harness                                            → 106, 107
SC-115  Deploy to Pages + Workers free tier, self-host docs                → 112, 113, 114
```

SC-113 and SC-114 depend only on early work, so the fixture corpus and CPU harness can be
built in parallel rather than blocking on the report.

Task files are written: `tasks/SC-101.md` .. `tasks/SC-115.md`, each carrying purpose,
scope in/out, file ownership, contracts, acceptance criteria, validation, and handoff notes.
Status is tracked in `tasks/INDEX.md`. Out-of-scope observations go to `tasks/FINDINGS.md`.

License resolved (MIT) — SC-101 is unblocked.
