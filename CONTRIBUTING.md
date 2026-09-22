# Contributing to SiteClarity

## Setup

```bash
npm install
npm test        # must pass offline, with no API key and no cost
npm run dev
```

If `npm test` needs a key or a network call, that is a bug — please report it. Tests use the
`replay` backend against recorded fixtures, and `wrangler.test.jsonc` deliberately omits the
`ai` binding so no remote session is opened.

## Before you start

Read **`AGENTS.md`** in full. It is the working agreement for everyone — human or AI — and
covers the invariants, scope rules, and what "done" means. It is short.

Then: `planning/DECISIONS.md` for frozen decisions, `tasks/INDEX.md` for current status.

## The rules that matter most

1. **Evidence is never model-authored.** Quotes are verbatim substrings of stored passages, looked up by ID.
2. **No scores.** No grade, rank, percentage, or overall rating — anywhere.
3. **Free tier only.** Nothing requiring a paid plan or a card on file.
4. **10 ms CPU.** A correctness limit, not a performance target: exceeding it fails the request.
5. **Stay in scope.** Found something else broken? Log it in `tasks/FINDINGS.md` and carry on.

## Pull requests

One task per branch. Include the real output of your task's validation commands — not a
summary, and never with failing or skipped tests.

```
SC-104: extract sections and stable passage IDs

Task: tasks/SC-104.md
```
