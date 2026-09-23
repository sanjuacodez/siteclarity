# Contributing to SiteClarity

## Setup

```bash
npm install
npm test        # must pass offline, with no API key and no cost
npm run dev     # http://localhost:8787
```

If `npm test` ever needs a key or a network call, that is a bug — please report it. Tests
use a `replay` backend against recorded fixtures, and `wrangler.test.jsonc` deliberately
omits the Workers AI binding so no remote session is opened.

## The rules that matter most

1. **Evidence is never invented.** Every quote must be a verbatim substring of a stored
   passage, looked up by ID. The decision model returns typed values only and cannot
   write prose — keep it that way.
2. **No scores.** No grade, rank, percentage or overall rating, anywhere, including in
   the UI. A per-question rubric `score` is an index into a legend, not a page grade;
   render the label, never the number.
3. **Free tier only.** Nothing that requires a paid Cloudflare plan or a card on file.
4. **10 ms CPU per request.** This is a correctness limit, not a performance target —
   exceeding it fails the request outright. `npm test` enforces an 8 ms budget.
5. **Say what was not checked.** Every report carries a limits block. Keep it honest.

## Editing the interface

`src/ui/dashboard.ts` is a TypeScript template literal containing HTML, CSS and
JavaScript, so **a single backslash in your JavaScript is consumed before the browser
sees it**. Inside a regex, double every backslash: `\\s`, `\\/`, `\\n`, `\\]`. Never let
`$` and `{` sit adjacent.

A syntax error anywhere in that script means nothing renders at all — no error, just an
inert page. `npm test` compiles the emitted script and fails on it; never skip it.

## Pull requests

One change per branch. Include the real output of the tests, and never open a PR with
failing or skipped tests.

## Found a vulnerability?

Do not open an issue or a pull request for it. Report it privately — see
[`SECURITY.md`](SECURITY.md), which also describes the SSRF guard and the
untrusted-content rules any change to `src/intake/` has to keep.
