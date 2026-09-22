# Decision-layer calibration baseline

## F29 follow-up — burial moved out of the model

The one case the model could never decide is now handled deterministically and removed
from its responsibilities.

`extraction_readiness` returned `"ready"` at 0.39 and `"buried"` at 0.34 across runs —
never confident, so the pipeline always discarded it. Burial is a **positional**
property, and position is what code is good at. The replacement uses lexical overlap:
a heading names what a section is about, so the sentence that addresses it reuses the
heading's words. Find the first such sentence; everything before it is preamble.

Measured behaviour:

| Page type | Result |
| --- | --- |
| cloudflare.com, acowebs.com, example.com | 0 findings — short marketing sections genuinely do not bury answers |
| a real long-form article | 2 of 11 eligible sections, at 144 and 28 words of preamble |

Selective rather than silent, and it reports the actual number of words a reader must
wade through instead of a judgement. It costs nothing, needs no key, and runs with the
decision layer switched off.

Where it deliberately says nothing: sections under three sentences (cannot bury
anything), headings with fewer than two topic words (nothing to measure overlap
against), and sections that never address their heading at all — that is
`answer_absent`, a different finding, and the model judges it well.

---


## 2026-09-23 (later) · after F27 and F28 · 19 cases

```
Agreement        18/19  (95%)     was 12/14 (86%)
False positives  0                unchanged — the number that matters
Overconfident    0                was 1
Input tokens     8,028
```

| Question | Agreement |
| --- | --- |
| answers_heading | 4/4 |
| self_contained | 3/3 |
| extraction_readiness | 3/4 |
| promotional_intensity | 4/4 |
| entity_clarity | 2/2 |
| claim_specificity | 2/2 |

**Five adversarial near-misses were added** specifically to check that lowering the
Choice threshold does not start inventing problems: a terse-but-complete answer, a
compact list, prose that mentions "each rule" without being unresolved, dry technical
copy, and mild positive framing carrying real figures. All five passed. Zero false
positives held.

### The one remaining failure is deliberate

`extraction_readiness/buried` still fails. The answer genuinely sits behind three
sentences of preamble, so `"buried"` is the right label — but the model returns
`"ready"` at 0.39 and `"buried"` at 0.34 across runs, never confident either way. **It
is weak at detecting burial.**

Relabelling it to match the output would make the score look better and hide a real
limitation. It stays red. Because the confidence is below the bar, the pipeline
discards the answer rather than reporting the wrong one, so no user is misled — the
finding is simply missing.

### One label was changed, for a reason worth stating

`answers_heading/answer-is-late` was relabelled from ambiguous to `true` **because the
question changed meaning** under F27, not because of an output. It no longer claims the
answer must appear "near the start", so a section that answers in its final sentence is
now unambiguously a yes. Changing a label to match a reworded question is legitimate;
changing one to match a result is not.

---


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
