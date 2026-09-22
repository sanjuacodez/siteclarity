# Decision-layer calibration baseline

Run with `npm run calibrate:live`. Needs a real key and spends real money, so it is
deliberately outside `npm test`.

## 2026-09-23 · jev-latest (jev-1.13.0) · 14 cases

```
Agreement        12/14  (86%)
False positives  0
Overconfident    1
Input tokens     5,946
```

| Question | Agreement |
| --- | --- |
| answers_heading | 2/3 |
| self_contained | 2/2 |
| extraction_readiness | 2/3 |
| promotional_intensity | 2/2 |
| entity_clarity | 2/2 |
| claim_specificity | 2/2 |

## What this establishes

**Zero false positives.** Across the corpus the model never reported a problem that
was not there. That is the error that matters most — a missed issue disappoints,
an invented one destroys trust in the whole report — so this is the number to watch
on every future run.

The rubric questions land accurately: `promotional_intensity` returned exactly 0.00 on
pure specifications and exactly 4.00 on a paragraph of superlatives.

## What it exposed

**1. `answers_heading` does not weight position the way its wording claims.**
The question says the answer should appear "near the start". Given a section whose
answer arrives only in the final sentence, the model returned 0.86 (yes) at 0.72
confidence. Judged purely on "is the answer present", that is correct — but it is not
what the question asks.

Burial is already caught by `extraction_readiness`, which labelled the same text
`buried`. So the two questions overlap, and `answers_heading` is effectively answering
"is the answer anywhere in this section". Either reword it to drop the positional claim,
or accept the overlap and rely on `extraction_readiness` for position.

**2. The 0.6 confidence threshold discards some correct answers.**
`extraction_readiness/buried` was answered **correctly** — `"buried"` — but at 0.34
confidence, so the pipeline drops it as `cannot_assess`.

This is a deliberate trade, not a bug: the threshold is what keeps false positives at
zero. Lowering it would recover findings like this one and admit wrong ones. Given that
a false positive costs more trust than a missed finding costs value, 0.6 stays until
there is evidence a lower value keeps false positives at zero.

Worth revisiting with per-question thresholds: `extraction_readiness` returns a
distribution across four options, so its confidence is structurally lower than a
two-way `noul`. A single global threshold penalises it.

## How cases are scored

- `expect: null` means the case is genuinely ambiguous and the honest answer is low confidence. The model passes by **not** being confident — hedging on a hard case is rewarded, not punished.
- Rubric scores allow one level of slack; adjacent levels are a judgement call.
- Anything below the confidence threshold counts as under-confident, even when the value is right, because the pipeline would discard it.
