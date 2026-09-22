# Features

What SiteClarity does today, what it deliberately refuses to do, and what is not built yet.
Written so someone arriving cold can get oriented fast.

---

## What it answers

> **Can a search or AI answering system find, understand and extract the answers this page
> contains?**

Not "is this page good". The output is a prioritised list of what to improve, each item
backed by a verbatim quote from the page.

---

## Built and working

### Three ways to run an analysis

| Mode | Input | Output |
| --- | --- | --- |
| **One page** | a single URL | findings grouped by issue |
| **Whole site** | a domain | discovers `sitemap.xml`, scans first N pages (default 8, max 25) |
| **My list of URLs** | textarea, one per line | same report, max 25 |

Site and list runs render a **table, one row per page**, sorted worst-first, each row an
accordion containing that page's findings.

### Findings

Each finding carries: what is true (`observation`), why it matters, what to do
(`recommendedAction`), a verbatim quote (`evidence`), a priority, and `highlights` — the
exact words on the page that triggered it, for `<mark>` highlighting.

All copy is **template-rendered**. There is no generative model anywhere in the system.

### Checks that need no model

Run always, including when the decision backend is unreachable — the basis of the free-tier
claim.

**Structure** — missing or malformed JSON-LD · missing FAQ markup on a question-heavy page ·
no H1 · multiple H1s · skipped heading levels · prose with no lists or tables · passages too
long to quote · `noindex` · `noai` · missing/invalid/off-site canonical · weak title ·
missing meta description · JavaScript-dependent rendering.

**Language** — anaphora load (passages opening with "it"/"this"/"they", which die when
quoted in isolation) · vague quantifiers with no figures · sentences too long to quote.
English-gated: other languages return nothing rather than applying English lexicons.

### Checks that use the decision model

Typed questions answered by Jev (or Kev, or Laya):

| Question | Type |
| --- | --- |
| Does this section answer the question its heading poses? | Noul |
| Is this section understandable in isolation? | Noul |
| Is the primary entity named unambiguously? | Noul |
| Does this passage make a checkable claim? | Noul |
| How specific is the claim? | Score |
| How promotional is the language? | Score |
| How extraction-ready is this section? | Choice |
| Which kind of fix would help most? | Choice |

Answers below the confidence threshold are **discarded**, not reported. `cannot_assess` is a
first-class outcome and always preferable to a guess.

### Noise control

Content the owner cannot act on is excluded **before** analysis and disclosed afterwards:

- **Testimonials and reviews** — detected by reviewer voice plus adjacency. You cannot rewrite a customer's words.
- **Link cards and related-post lists** — their text is boilerplate repeated across sections.
- **Navigation, headers, footers, sidebars** — suppressed during extraction.
- **Thin sections** — nav blocks, card grids.

Measured effect on one real page: **64 findings (27 high) → 10 findings**, and 154 decision
calls → 38.

### Honesty features

- **Quote verification gate** — every quote must be a verbatim substring of a stored passage. Zero tolerance; a failing finding is dropped, never repaired.
- **Limits block** — every report states what was and was not examined: single page only, sections skipped and why, language, JS-dependency, whether the model ran.
- **Visible degradation** — if the decision model is unreachable, the static layer still runs and the report says so.

### `/checks` page

Documents every check, question and option — **generated from the catalogue in source**, so
it cannot drift from what actually runs, cannot claim a check that does not exist, and cannot
omit one that does.

### Model portability

| Model | Licence | Runs | Interface |
| --- | --- | --- | --- |
| **Jev** (TypeSafe) | proprietary | Workers AI binding, or the API | System One |
| **Kev** | self-hosted, Qwen3.5 | your GPU | System One |
| **Decider** | Apache-2.0 | your GPU | System One |
| **Laya** (Convai) | Apache-2.0 | your GPU | own, adapted |

Jev, Kev and Decider share `POST /v1/systemone`, so switching is a base-URL change.

---

## Deliberately not built

These are product decisions, not gaps.

| Never | Why |
| --- | --- |
| An overall score, grade, rank or percentage | The product answers "what to improve next", not "how good is this". Every competing tool leads with a number that means nothing. |
| Citation probability / AI-visibility prediction | Not measurable from page content. |
| Search volume or traffic estimates | Requires data the product deliberately does not connect to. |
| Rewriting your copy | It shows which words need rework and leaves the writing to you. |
| Any generated prose | It is what makes fabricated evidence structurally impossible. |
| Accounts, logins, stored history | An audit is one-shot; nothing needs persisting. |

---

## Not built yet

| | |
| --- | --- |
| **Export** | JSON / Markdown / HTML download (`SC-112`) |
| **Calibration corpus** | hand-labelled fixtures to measure accuracy rather than eyeball it (`SC-113`) |
| **Deployment** | not attempted — needs a Cloudflare `account_id` |
| **Modules 2–10** | portfolio, messaging, buyer journey, question coverage, audience, overlap, opportunity aggregation. See `planning/DECISIONS.md`. |

Module 1 (AI Readiness) is the only one implemented. The other nine are planned around the
same `Finding` contract so they can be added without reworking it.

---

## Known rough edges

- Passage-level findings show no section name, so several read as "A claim here is too vague to be checked" with no location.
- Jev sometimes judges a bulleted section as containing no substantive answer.
- Isolated single testimonials not adjacent to others can still slip through.
- The entire UI is one template literal — see `docs/UI.md` §1 before editing it.

---

## Running it

```bash
npm install
npm test        # offline, no API key, no cost
npm run dev     # http://localhost:8787
```

Requires a free Cloudflare account. No credit card. No API key — Jev runs through the
Workers AI binding inside the free daily allowance. A `JEV_API_KEY` in `.dev.vars` is
optional and only needed to call the TypeSafe API directly.
