# UI contract

Everything an agent or developer needs to change the SiteClarity interface without
breaking it. Read this **before** editing `src/ui/`.

The rest of the working agreement is in `AGENTS.md`; this file covers the UI specifically.

---

## 1. Read this first: the escaping hazard

The UI is a TypeScript **template literal** containing HTML, CSS and JavaScript:

```ts
export const DASHBOARD_HTML = `<!doctype html> … <script> … </script>`
```

That means **the JavaScript you write is escape-processed before the browser ever sees it.**
A single backslash is consumed. This has broken the entire page twice.

| You write | Browser receives | Result |
| --- | --- | --- |
| `/\/$/` | `//$/` | starts a comment — **whole script dies** |
| `/[\n,]+/` | regex split across two real lines | **unterminated regex** |
| `\s+` | `s+` | matches the letter "s" |
| `[\]]` | `[]]` | character class closes early |

**Rule: inside a regex literal, double every backslash.** Write `\\s`, `\\/`, `\\n`, `\\]`.
Inside an ordinary string `\n` is fine — it becomes a real newline, which is usually what
you want.

`${` is also template-interpolation syntax. Never let `$` and `{` sit adjacent inside the
literal; reorder the character class instead (`/[-.*+?^$()|[\]{}\\]/`).

**A syntax error anywhere in that script means nothing renders at all** — no error, no
partial page, just an inert form. If the page goes blank, suspect this first.

`test/unit/dashboard.test.ts` compiles the emitted script with `new Function()` and fails on
a syntax error. Run `npm test` after every UI edit; it is the only thing standing between a
stray backslash and a dead page.

**If you rewrite the UI as real files** (a Vite build, separate `.js`) this whole class of
bug disappears. That would be a genuine improvement — the template literal exists only
because it needs no build step.

---

## 2. Where things live

| File | Contains |
| --- | --- |
| `src/ui/dashboard.ts` | the whole dashboard — HTML, CSS, client JS |
| `src/ui/checks.ts` | `/checks`, **generated from the check catalogue in source** |
| `src/index.ts` | routes: `GET /`, `GET /checks`, `GET /health`, `GET /api/sitemap`, `POST /api/analyze` |

`checks.ts` renders from `CHECKS`, `STATIC_TEMPLATES`, `LANGUAGE_TEMPLATES` and the question catalogue deliberately, so the page can
never claim a check that does not exist. Keep that property — do not hand-write its content.

Serving is plain: `c.html(DASHBOARD_HTML)`. No build step, no bundler, no CDN. External
scripts and stylesheets are not loaded and should not be added — the Worker is the only
origin.

---

## 3. The data you render

`POST /api/analyze` with `{ "url": "…" }` returns:

```jsonc
{
  "schemaVersion": "0.1.0",
  "input":  { "requestedUrl", "finalUrl", "fetchedAt", "title" },
  "limits": {
    "scope": "single_page",
    "statements": ["Only the single page you submitted was analysed…"],
    "decisionsRan": true, "sectionsAnalyzed": 1, "sectionsTotal": 1,
    "stateSplit": false, "language": "en", "languageSupported": true,
    "jsDependent": false
  },
  "sections": [{ "sectionId", "heading", "level", "passageCount", "decisions": {…} }],
  "findings": [{
    "id", "module", "checkId",
    "observation":        "This page has no structured data.",
    "evidence":          [{ "passageId", "quote", "sectionId" }],
    "whyItMatters":       "…",
    "recommendedAction":  "…",
    "affects":           [{ "pageUrl", "sectionId?" }],
    "priority":           "high" | "medium" | "low",
    "confidence":         "high" | "medium" | "low",
    "highlights":        ["world-class", "best"],
    "copySource":         "template"
  }],
  "provider": { "backend", "model", "calls", "inputTokens", "outputTokens",
                "degraded", "degradedReason" },
  "timings":  { "totalMs", "extractMs", "decideMs" },
  "summary":  { "count", "high", "medium", "low" }
}
```

Notes that matter for rendering:

- **`findings` is the report.** Use `sections` only to resolve section headings and extracted passage counts, not to expose raw decisions. `_debug` is not a UI dependency.
- **`highlights`** are the exact words on the page that triggered the finding. Wrap them in `<mark>` inside the quote. The product shows which words need rework and deliberately does not rewrite them.
- **`evidence[].quote` is verbatim page text**, resolved from a stored passage. Never alter it beyond escaping.
- **`limits.statements` must always be displayed**, and not buried. It is what keeps the report honest about what was examined.
- **`provider.degraded`** means semantic analysis was unavailable or incomplete. Static checks remain available; successful semantic calls may also have contributed findings. Say so visibly rather than presenting the report as complete. `limits.decisionsRan === false` also gets a limited-coverage notice.
- `_debug` may disappear without notice. Do not build UI that depends on it.

`GET /api/sitemap?url=…&limit=N` returns
`{ sitemapUrl, urls[], totalFound, truncated, viaRobots }`.

---

## 4. Hard design constraints

These are product invariants, not preferences (`AGENTS.md` §2).

1. **Never render a score, grade, percentage, rank or rating.** Not a number, not a gauge, not a progress ring, not a letter. The product answers "what should I improve next", never "how good is this". A `decisions.*.score` is a per-question rubric index — render the matching `legend` **label**, never the number. `0.48` against a five-level rubric is not "48%".
2. **Never display a quote that did not come from `evidence[].quote`.** No paraphrasing, no truncating mid-word without an ellipsis, no reconstructing text from `sections`.
3. **Always show `limits`.**
4. **Degrade visibly.** A static-only run must look different from a complete one.

## 5. Interaction model

Three input modes, tabs at the top:

| Mode | Flow |
| --- | --- |
| **One page** | `POST /api/analyze` once → `render()` |
| **Site scan** | `GET /api/sitemap` → then one `POST /api/analyze` per URL → `renderSite()` |
| **URL list** | textarea, one per line, deduplicated and validated, maximum 25 → same loop → `renderSite()` |

**The browser drives the multi-page loop on purpose.** Ten pages of extraction in one request
is roughly 80 ms of CPU against Cloudflare's 10 ms free-tier limit, which fails outright
(error 1101). Each page must stay its own request. Three run in parallel (`PARALLEL = 3`);
raising that is fine, moving the loop server-side is not.

Site and list results render as a **table, one row per successful page**, sorted by high-priority
count, then finding count. Native buttons expand each row, including pages with no findings,
so scope and provider limitations remain accessible. Failed URLs appear separately with their
errors. Selected, successful and failed page counts never imply whole-site coverage.

Tabs use arrow keys, Home and End. Inactive form controls are disabled so hidden required
inputs cannot block another mode. Busy state locks scope and input controls. URL lists reject
more than 25 unique URLs rather than silently dropping extras; duplicate normalised URLs are
removed. Progress updates only the status text, and results render once the scan finishes.

Single-page filters select findings **before** grouping by check and priority. Native
`details` controls reveal exact quotes, passage references, section names and recommended
actions. No-findings states explicitly avoid claiming complete readiness. Completed reports
receive focus and scroll into view; a separate live region announces progress.

**Accordion ids must be globally unique.** `renderGroups` uses a module-level counter
(`__gid`) because a multi-page report calls it once per page; a per-call index produced eight
elements with id `g0` and every toggle opened the first one.

## 6. Styling

CSS custom properties on `:root`, redefined under `@media (prefers-color-scheme: dark)`.
Never give a colour its only definition inside the dark block. Keep the page working at
~400px; the table is the only element allowed to scroll horizontally, inside `.tscroll`.

The workspace uses violet accents, off-white surfaces and a charcoal dark theme. The audit
setup, report hierarchy and `/checks` use matching navigation and disclosure patterns.
Current dashboard tokens: `--bg --surface --soft --border --text --muted --accent --accent-soft
--button --warn --warn-soft --bad --bad-soft --good --good-soft --shadow --radius`.

## 7. Testing a UI change

```bash
npm test                 # includes the script-integrity suite — never skip
npm run dev              # http://localhost:8787
```

`npm test` runs fully offline with no API key. Live analysis needs `.dev.vars`
(see `.dev.vars.example`); the default Workers AI backend needs no key at all.

Worth exercising by hand: a page with many findings, a page with none, a **degraded** run
(stop the backend), a non-English page, and a site scan where some pages fail.

## 8. Known UI problems worth fixing

- The whole UI is one template literal. Moving to real files removes the escaping hazard entirely — see §1.
- No export yet (JSON / Markdown / HTML download) — `SC-112` calls for it.
- There is no scan cancellation or persisted report history; keep the tab open while running.
- Catalogue copy and backend judgment calibration are independent of UI presentation. A clear
  interface does not establish that every heuristic or model judgment is correct.

SC-116 resolves the missing single-page renderer, missing error renderer, mode validation,
keyboard disclosures, empty states, source-heading lookup and missing per-page limits.
