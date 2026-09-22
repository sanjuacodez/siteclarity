# Test fixtures

## Why these are frozen HTML files

Tests never fetch a live website. Live pages change, which turns a regression test into a
flake, makes CI depend on a third party staying online, and means a failure can no longer be
reproduced. Every fixture here is a snapshot captured once and committed.

## Provenance

| File | Source | Captured | Why it is in the corpus |
| --- | --- | --- | --- |
| `acowebs-home.html` | acowebs.com | 2026-09-22 | Heavy marketing copy, ~150 headings, a large testimonial carousel. The page that exposed the testimonial and thin-section noise problems. |
| `cloudflare-workers-ai.html` | cloudflare.com | 2026-09-22 | Large (855 KB), well-structured. Upper bound for CPU measurement. |
| `sanjayshankar-ai-search.html` | sanjayshankar.me | 2026-09-22 | Long-form article with related-post cards and a site footer. The page that exposed the page-chrome extraction bug (F12). |
| `sanjayshankar-home.html` | sanjayshankar.me | 2026-09-22 | Short personal homepage; a low-finding case. |

## Copyright

These are third-party pages retained for automated testing. Prefer pages you own, or
synthetic HTML written to exhibit a specific characteristic — most tests in this repo build
their own markup inline for exactly that reason. Keep real snapshots to the minimum needed
and record the source above.

## Adding a fixture

1. Capture with `curl -sL -A "SiteClarityBot/0.1" <url> -o test/fixtures/html/<name>.html`
2. Add a row above saying *why* it earns a place — what characteristic it exercises.
3. Import with `?raw`: `import page from '../fixtures/html/<name>.html?raw'`
