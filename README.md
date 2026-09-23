# SiteClarity

**Can a search engine or AI assistant find, understand and quote the answers on your page?**

SiteClarity reads a web page and tells you what to fix — every finding backed by a
word-for-word quote from your own content. It never gives you a score, a grade or a
traffic estimate. It answers one question: *what should I change next?*

Free, open source, and built as a practical application of
**[Jev](https://typesafe.ai)** — TypeSafe AI's System One decision model.

> **Live:** https://siteclarity.sanjay-shankar.workers.dev
> **Source:** https://github.com/sanjuacodez/siteclarity

### See it run

[![Watch SiteClarity audit a page](https://img.youtube.com/vi/Fd_TAiQClr0/maxresdefault.jpg)](https://www.youtube.com/watch?v=Fd_TAiQClr0)

_A full audit from URL to findings — structural checks, meaning checks, and the
copy-prompt output. **[Watch on YouTube](https://www.youtube.com/watch?v=Fd_TAiQClr0)**_

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

**What the page says it is** — for what it does, who it is for, the problem it solves and
what makes it different, the model is shown a shortlist of *your own sentences* and asked
which one states that thing. You get your words back verbatim, or an honest "not stated".
It never writes a summary, because a System One model cannot write at all. That
constraint shaped the design rather than being worked around: a generated paraphrase
would mean nothing in a report could be trusted as verbatim, and the guarantee is not
divisible.

**Full list, always current:** the [`/checks`](https://siteclarity.sanjay-shankar.workers.dev/checks)
page on the running app is generated from the code itself, so it can never claim a check
that doesn't exist.

## What it deliberately ignores

Content you cannot act on is excluded *before* analysis, and the report says so:

- **Customer reviews and testimonials** — you cannot rewrite a customer's words
- **Related-post cards, navigation, headers, footers**
- **Non-English pages** — the language checks are English-only and say so rather than guessing

## Tell it what the page should say

Optional, on a single-page audit: write up to three things you believe the page
communicates — who it is for, the problem it solves, what makes you different.

SiteClarity then checks whether the page actually says them, and reports the gaps:

> **You said this page is about "we are built for agencies managing many client stores"
> — but no sentence here says so.**

That gap is invisible to whoever wrote the page, because they already know what they
meant. It never judges whether the statement is *true* — only whether the page says it.

## Three ways to run it

| Mode | Input |
| --- | --- |
| **One page** | a single URL |
| **Whole site** | a domain — finds `sitemap.xml` and scans the first N pages |
| **Your own list** | paste up to 25 URLs |

Site and list runs produce a table, one row per page, worst first. Open a row to see that
page's findings.

### Checks that need several pages

A scan also reports what only becomes visible across pages — *"only 0 of 5 pages say who
they are for"*, *"4 of 5 offer no next step"*.

Those cost almost nothing. Every page has already been judged individually, so the
site-level pass **counts existing judgements** rather than re-reading anything: each page
returns a compact summary of typed values, the browser accumulates them, and one final
call carries the inventory. Twenty-five pages come to roughly a thousand tokens.

It stays database-free — the inventory lives in the tab exactly as the report does,
which is also why a scan cannot be resumed after a reload. Nothing was ever persisted.

## Your own API key, stored in your browser

The hosted instance holds **no credentials at all**, so it cannot spend anyone's quota
but your own. Paste your [TypeSafe Jev](https://typesafe.ai) key into the API key box
and it is saved in your browser's local storage — sent with each audit request, never
written to the server.

It is stored in `localStorage` rather than a cookie on purpose: a cookie is attached
automatically to every request the browser makes to the origin, which puts the key in
far more places than it needs to be.

**Without a key** you still get the full structural analysis — structured data, heading
hierarchy, extractability, vague language — clearly marked as partial in the report.

## Swap the model, from the dashboard

Open **API key** in the app and pick a decision model. The choice is stored in your
browser and sent with each audit — nothing is configured server-side, so two people can
point the same deployment at different models.

| Model | Licence | Runs on | Wire format |
| --- | --- | --- | --- |
| **Jev** | proprietary | TypeSafe hosted API | `POST /v1/systemone` |
| **Kev** | self-hosted, Qwen3.5 (0.8B/4B/9B) | your hardware | same as Jev — base URL only |
| **Decider** | Apache-2.0, 2B | your hardware | same as Jev — base URL only |
| **Laya** | Apache-2.0, 421M | your hardware | `POST /ai/run` — own adapter |

Kev and Decider implement TypeSafe's format, so switching to them is nothing but a
different server URL. **Laya is not wire-compatible** — it nests the request under
`input` and uses a different endpoint — so it has its own adapter.

One practical difference worth knowing: Jev has a 32k context, while a local Laya
checkpoint has **512 tokens** (about 320 for the state). SiteClarity sends each question
the smallest state that can answer it — section states measure around 300 tokens — which
is why Laya works at all. Very long sections may still be rejected, and Laya returns an
explicit error rather than silently truncating.

A server URL you enter is validated with the same host rules as page fetching, so a
hosted instance cannot be used to reach private addresses. Running both locally? Set
`ALLOW_PRIVATE_BACKEND=true` to permit `localhost`.

## Run it locally

```bash
npm install
npm test        # fully offline, no API key, no cost
npm run dev     # http://localhost:8787
```

## Deploy your own

```bash
npx wrangler deploy
```

A free Cloudflare account is enough. No credit card. Set `account_id` in
`wrangler.jsonc` to your own, then either let visitors bring their own keys (the default)
or uncomment the `ai` binding to use your free Workers AI allowance.

## Contributing

See [`CONTRIBUTING.md`](CONTRIBUTING.md). The short version: `npm test` must pass offline
with no API key, quotes must be verbatim, and the report never shows a score.

## Status

**Pre-alpha.** Five of ten planned modules are built — answer readiness, evidence &
trust, messaging, website understanding, and audience coverage across a site.

Every check the product can emit is documented at
[`/checks`](https://siteclarity.sanjay-shankar.workers.dev/checks), generated from the
same catalogues the analysis uses, so that page cannot claim a check that does not exist
or omit one that does.

Accuracy is measured rather than asserted: a hand-written corpus of 58 cases is run
against the live model with `npm run calibrate:live`, and the current baseline is
recorded in the repository. False positives are tracked separately from overall
agreement, because reporting a problem that is not there costs more trust than missing
one costs value.

## Known limits

- **250 KB page cap** — extraction costs ~0.02 ms/KB against Cloudflare's 10 ms free-tier CPU limit. Larger pages are analysed up to the cap, and the report says so.
- English-only language checks
- JavaScript-rendered pages are flagged, not rendered
- One page per request; multi-page scans run from the browser by design

## Licence

MIT

---

Built by **[Sanjay Shankar M](https://sanjayshankar.me)** · [doable.team](https://github.com/doable-team/)

[sanjayshankar.me](https://sanjayshankar.me) · [X](https://x.com/sanjayshankarr/) · [LinkedIn](https://www.linkedin.com/in/sanjay-shankar-a6885224/) · [GitHub](https://github.com/sanjuacodez)

If SiteClarity saved you some time, you can
[buy me a coffee](https://buymeacoffee.com/sanjayshankar).
