# Task index — Module 1: AI / Answer Readiness

Update the Status column when you start (`IN_PROGRESS`) and finish (`DONE`).
Working rules: `AGENTS.md`. Frozen decisions: `planning/DECISIONS.md`.

Last updated: 2026-09-23 (Codex UI integration, copy rewrite, copy-prompt) · Planning complete (DECISIONS revision 4 — System One / Jev).
**A working vertical slice exists** — see "Spike status" below. Tasks marked PARTIAL have
working code from the spike but have not met their full acceptance criteria.

## Status

| Task | Title | Status | Depends on |
| --- | --- | --- | --- |
| SC-101 | Repository, license, CI, contributor setup | DONE | — |
| SC-102 | Worker shell: routing, config, bindings | PARTIAL | 101 |
| SC-103 | URL intake: normalisation, SSRF guards | DONE | 102 |
| SC-104 | Extraction: sections, passages, stable IDs | PARTIAL | 103 |
| SC-105 | The Finding contract | PARTIAL | 101, 102 |
| SC-106 | Static layer: structure and extractability | PARTIAL | 104, 105 |
| SC-107 | Static layer: language signals | PARTIAL | 104, 105 |
| SC-108 | Decision model adapter: Jev / Kev / Decider / Laya | PARTIAL | 102 |
| SC-109 | Decision layer: page state and typed questions | PARTIAL | 106, 108 |
| SC-110 | Quote verification gate | DONE | 109 |
| SC-111 | Finding assembly, prioritisation, limits | PARTIAL | 107, 110 |
| SC-112 | Report UI and exports | PARTIAL | 111 |
| SC-113 | Fixture corpus and calibration harness | DONE | 110 |
| SC-114 | CPU budget test harness | DONE | 106, 107 |
| SC-115 | Deployment and self-host documentation | TODO | 112, 113, 114 |
| SC-116 | Audit workflow and interface refinement | IN_PROGRESS | Existing UI slice |

License resolved 2026-09-22: **MIT**. No task is currently blocked on a human decision.

## Spike status — verified against reality 2026-09-22

A working vertical slice runs end to end: `npm run dev` → `localhost:8787` → dashboard →
live Jev analysis. 11 tests pass offline with no key.

| Verified | Result |
| --- | --- |
| HTMLRewriter extraction in workerd | Works. ~0.02 ms/KB. |
| **10 ms CPU budget** | **Breached at 855 KB (p90 11 ms).** `MAX_PAGE_BYTES` cut 2 MB → 500 KB. |
| **32k state budget** | **Solved.** Whole-page state 13,050 tok; largest scoped state **293 tok**. |
| Passage ID stability | Identical across repeat runs. |
| Live Jev 1.13.0 API | Works. `POST /v1/systemone`, ~950 ms for 2 calls, 1,263 input tokens. |
| Offline testing | Works, but only after splitting out `wrangler.test.jsonc` (F4). |
| Workers AI locally | Does **not** run locally — proxies to Cloudflare, needs auth (F5). |
| Findings pipeline | Works. Templated copy, verified quotes, priority ordering. |
| **Noise control** | acowebs.com: 64 findings/27 high → **19 findings/1 high**; 154 calls → 48. |
| Dashboard + `/checks` | Served by the Worker at `/` and `/checks`; checks page generated from the catalogue. |
| Tailored suggestions | Hype lexicon extracts the actual words; Jev `Choice` picks which fix applies. No generation. |
| Language signals | SC-107 built: anaphora load, vague quantifiers, sentence length. English-gated; non-English returns nothing rather than guessing. |
| Input modes | One page / whole site / pasted URL list (textarea, capped at 25). |
| Deterministic layer | SC-106 built: structured data, heading hierarchy, extractability, machine access. Produces findings with **no model at all** — verified. |
| SSRF corpus | 36 adversarial URLs + 8 that must be accepted. All pass. |
| Quote gate | Proven with fabricated, altered, stitched and dangling-reference evidence. |
| CPU gate | **Enforced at 8 ms.** First enforced run found 500 KB cost 11 ms → `MAX_PAGE_BYTES` cut to 300 KB. |
| Copy prompt | Per-finding button producing an agent-ready instruction; clipboard with textarea fallback. |
| Plain English | All finding copy rewritten — 60 strings across four template files. |
| Calibration | 4 hand-labelled fixtures. Found 2 of my own labels wrong, code correct. |
| Site scan | `GET /api/sitemap` + browser-driven per-page loop (each page its own invocation, own CPU budget). Verified on sanjayshankar.me: 30 pages found. |

Still unverified: Jev neuron cost via the Workers AI binding; whether `AI` binding calls
count against the 50-external or 1,000-CF-services subrequest limit.

## Dependency graph

```
101 ──┬── 102 ──┬── 103 ── 104 ──┬── 106 ──┬── 109 ── 110 ──┬── 111 ── 112 ──┐
      │         │                │         │                │               │
      └─────────┤                └── 107 ──┤                └── 113 ────────┤── 115
                │                          │                                │
                ├── 105 ───────────────────┤                                │
                │                          │                                │
                └── 108 ──────────── 109   └── 114 ────────────────────────┘
```

## Suggested parallel tracks

Three agents can work concurrently after SC-102 lands, with no file collisions:

| Track | Tasks | Owns |
| --- | --- | --- |
| A — pipeline | 103 → 104 → 106 → 107 | `src/intake`, `src/extract`, `src/static` |
| B — contracts & provider | 105 → 108 | `src/contracts`, `src/provider` |
| C — quality | 114, then 113 | `test/cpu`, `test/fixtures`, `test/calibration` |

Tracks converge at SC-109. Run SC-101 and SC-102 solo — everything else builds on the layout
and bindings they fix, and parallelising them only creates conflicts.

## Critical path

`101 → 102 → 103 → 104 → 106 → 109 → 110 → 111 → 112 → 115` — ten tasks.
SC-105, 107, 108, 113, 114 can all be built off the critical path.

## The four tasks that carry the most risk

| Task | Risk |
| --- | --- |
| SC-104 | Passage IDs are referenced by every finding in every future module. Unstable IDs break everything downstream and the breakage is silent. |
| SC-105 | The `Finding` contract is shared by all ten modules. Changing it later means revisiting each one. |
| SC-108 | Backend portability (Jev ↔ Kev ↔ Decider ↔ Laya) must be config-only. If a backend detail leaks into call sites, switching models later means touching every caller. |
| SC-110 | The quote gate is the product's core promise made executable. Weakening it for convenience removes the main differentiator. |
| SC-114 | 10 ms CPU is a hard failure (error 1101), not a slowdown. Discovering a breach at deploy time means redesigning, not tuning. |

## Not scheduled

Modules 2–10 are not scheduled until module 1 ships. Build order and rationale are in
`planning/DECISIONS.md`. Do not begin work on them; do not add abstractions in anticipation
of them (`AGENTS.md` §3).
