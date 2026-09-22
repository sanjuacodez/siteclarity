# SiteClarity

**Can a search engine or AI assistant find, understand and quote the answers on your page?**

SiteClarity reads a web page and tells you what to fix — every finding backed by a
word-for-word quote from your own content. It never gives you a score, a grade or a
traffic estimate. It answers one question: *what should I change next?*

Free, open source, and built as a practical application of
**[Jev](https://typesafe.ai)** — TypeSafe AI's System One decision model.

> **Live:** _pending first deploy_
> **Source:** https://github.com/sanjuacodez/siteclarity

---

## Why this exists

Most SEO tools hand you a number — *"SEO score: 72/100"* — and a few hundred warnings.
Neither tells you what to do on Monday morning.

SiteClarity reports a short, ordered list of concrete problems, each with the exact text
from your page that caused it, and each with a **Copy prompt** button so you can hand the
fix straight to an AI coding agent.

## There is no generative AI in this product

That sounds like a limitation. It is the entire point.

A System One model like Jev returns only values from a fixed schema — a yes/no, a choice
from a list, a rating on a rubric. It **cannot write a sentence**, which means it cannot
invent a quote, fabricate a statistic, or hallucinate a problem that isn't there.

```
deterministic extraction → typed decisions → templated findings
  HTMLRewriter              Jev / Kev / Laya    no generated prose
```

Every quote you see is verified to be a word-for-word substring of your page before it is
shown. Every sentence of advice is a template. Nothing is generated, so nothing can be
made up.

About half the analysis needs no model at all, so **the tool still produces useful
findings with the model switched off entirely.**

## What it checks

**Structure** — missing or broken structured data · missing FAQ markup on a Q&A page ·
no H1 · multiple H1s · skipped heading levels · walls of prose with no lists or tables ·
paragraphs too long to quote · `noindex` · `noai` · missing or wrong canonical · weak
title · missing meta description · JavaScript-dependent rendering.

**Language** — paragraphs starting with "it"/"this"/"they" that stop making sense when
quoted alone · vague words like "many" and "several" with no real numbers · sentences too
long to quote.

**Meaning** (via Jev) — does a section answer its own heading · does it make sense in
isolation · is the subject clearly named · is a claim specific enough to check · how
promotional is the language · how ready is the section to be quoted.

**Full list, always current:** [`/checks`](docs/FEATURES.md) on the running app is
generated from the code itself, so it can never claim a check that doesn't exist.

## What it deliberately ignores

Content you cannot act on is excluded *before* analysis, and the report says so:

- **Customer reviews and testimonials** — you cannot rewrite a customer's words
- **Related-post cards, navigation, headers, footers**
- **Non-English pages** — the language checks are English-only and say so rather than guessing

## Three ways to run it

| Mode | Input |
| --- | --- |
| **One page** | a single URL |
| **Whole site** | a domain — finds `sitemap.xml` and scans the first N pages |
| **Your own list** | paste up to 25 URLs |

Site and list runs produce a table, one row per page, worst first. Open a row to see that
page's findings.

## Your own API key, stored in your browser

The hosted instance holds **no credentials**. Paste your own
[TypeSafe Jev](https://typesafe.ai) key into the API key box and it is saved in your
browser's local storage — sent with each audit request, never stored on the server.

Without a key you still get the full deterministic analysis, clearly marked as partial.

## Swap the model

Jev, **Kev** and **Decider** all speak TypeSafe's `POST /v1/systemone` format, so
switching is a base-URL change. **Laya** (Apache-2.0, runs on your own GPU) is adapted
behind the same interface.

| Model | Licence | Runs on |
| --- | --- | --- |
| Jev | proprietary | TypeSafe API, or Cloudflare Workers AI |
| Kev | self-hosted, Qwen3.5 | your GPU |
| Decider | Apache-2.0 | your GPU |
| Laya | Apache-2.0 | your GPU |

## Run it locally

```bash
npm install
npm test        # 177 tests, fully offline, no API key, no cost
npm run dev     # http://localhost:8787
```

## Deploy your own

```bash
npx wrangler deploy
```

A free Cloudflare account is enough. No credit card. Set `account_id` in
`wrangler.jsonc` to your own, then either let visitors bring their own keys (the default)
or uncomment the `ai` binding to use your free Workers AI allowance.

## Documentation

| | |
| --- | --- |
| [`docs/FEATURES.md`](docs/FEATURES.md) | every feature and deliberate non-feature |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | how a URL becomes a report |
| [`docs/UI.md`](docs/UI.md) | **read before touching the interface** |
| [`AGENTS.md`](AGENTS.md) | working rules for humans and AI agents |
| [`tasks/INDEX.md`](tasks/INDEX.md) | build status · [`tasks/FINDINGS.md`](tasks/FINDINGS.md) known issues |

## Status

**Pre-alpha.** Module 1 of a planned ten (AI Readiness) is built and working.

```
32 source files · ~4,900 lines · 177 tests passing offline
```

## Known limits

- **300 KB page cap** — extraction costs ~0.02 ms/KB against Cloudflare's 10 ms free-tier CPU limit
- English-only language checks
- JavaScript-rendered pages are flagged, not rendered
- One page per request; multi-page scans run from the browser by design

## Licence

MIT
