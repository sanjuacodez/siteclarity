import type { Question } from '../provider/types'

/**
 * SC-109 — the module 1 question catalogue.
 *
 * Data, not code, so it is versioned and reviewable. Every readiness dimension is
 * already an enum or a rubric, which is exactly why a System One model fits: nothing
 * here needs free text.
 */

export const QUESTION_CATALOGUE_VERSION = '0.4.0'

/** Asked once per page, against page-scope state. */
export const PAGE_QUESTIONS: Record<string, Question> = {
  /**
   * Calibration produced the corpus's only false positive here: given a page calling
   * its product "ACP" and never expanding it, the model answered "clearly named" at
   * 0.88. A consistently repeated token is not the same as an identifiable entity —
   * an acronym nobody can expand connects the page to nothing. The criteria now say so.
   */
  entity_clarity: {
    type: 'noul',
    instructions:
      'A reader arriving cold could say what product, service or organisation this page is about.',
    criteria: {
      true: 'A full name appears that identifies the subject — something you could search for and find.',
      false:
        'The subject is only "we", "our platform", "the solution", or an acronym that is never expanded. A repeated label is not a name if nothing says what it stands for.',
    },
  },
  purpose_clarity: {
    type: 'choice',
    instructions: 'What is the primary purpose of this page?',
    criteria: {
      explain: 'Explains a concept, topic or how something works.',
      sell: 'Presents a product or service and encourages a purchase or signup.',
      compare: 'Compares options, alternatives or approaches.',
      support: 'Helps an existing user accomplish or troubleshoot a task.',
      navigate: 'Primarily routes visitors elsewhere, with little content of its own.',
      unclear: 'No single purpose is discernible from the content.',
    },
  },
}

/**
 * Module 3 — Messaging Intelligence.
 *
 * Asked against page-scope state, because these are properties of the page's argument
 * rather than of any one section. Three dimensions from the product brief; the rest of
 * the list (benefit clarity, trust, evidence) is either already covered by modules 1
 * and 2 or waits until these are calibrated.
 */
export const MESSAGING_QUESTIONS: Record<string, Question> = {
  states_the_problem: {
    type: 'noul',
    instructions: 'The page says what problem it solves, not only what it offers.',
    criteria: {
      true: 'A reader learns which situation or difficulty this exists to address.',
      false:
        'It lists features, qualities or a description with no sense of what goes wrong without it.',
    },
  },
  names_the_audience: {
    type: 'noul',
    instructions: 'The page says who it is for.',
    criteria: {
      true: 'A specific kind of person, role or business is named, so a reader can tell whether they qualify.',
      false:
        'It addresses "everyone", "teams", "businesses" or nobody in particular, so a reader cannot tell if it is meant for them.',
    },
  },
  states_differentiation: {
    type: 'noul',
    instructions: 'The page says what makes this different from the alternatives.',
    criteria: {
      true: 'It names a specific difference — something it does that others do not, or a deliberate trade-off it makes.',
      false:
        'It only claims to be good. Being "powerful" or "easy" is not a difference, because every competitor says the same.',
    },
  },
}

/**
 * Module 6 — Buyer journey.
 *
 * One Choice per page, riding in the existing page-scope call, so it costs nothing extra.
 * The stage itself is a judgement; which stages a site has left empty is arithmetic, and
 * that is where the finding comes from.
 *
 * The options are the six stages from the product brief. `none` matters as much as the
 * rest: a page that serves no stage is usually navigation, and counting it as content
 * would overstate coverage.
 */
export const JOURNEY_QUESTIONS: Record<string, Question> = {
  journey_stage: {
    type: 'choice',
    instructions:
      'Where in a buying decision would someone read this page? Pick the earliest stage it genuinely serves.',
    criteria: {
      awareness:
        'For someone who has the problem but does not know solutions exist. Describes the situation, not a product.',
      education:
        'For someone who knows the problem and is learning how it is solved. Explains an approach or a concept.',
      consideration:
        'For someone assessing whether this kind of product fits them. Covers capabilities, requirements, use cases.',
      comparison:
        'For someone weighing options against each other. Names alternatives, trade-offs or differences.',
      decision:
        'For someone close to committing. Pricing, plans, guarantees, what happens after buying.',
      purchase:
        'The transaction itself — checkout, signup, booking, contact form.',
      none:
        'Serves no stage: navigation, a legal page, or a listing that only links elsewhere.',
    },
  },
}

/** Asked once per section, against section-scope state. */
export const SECTION_QUESTIONS: Record<string, Question> = {
  /**
   * NOTE: this question deliberately does NOT mention position.
   *
   * It used to ask whether the answer appeared "near the start", and live calibration
   * showed the model ignoring that — it returned 0.86 (yes) at 0.72 confidence for a
   * section whose answer arrived only in the final sentence. Judged on "is the answer
   * present" that is correct; it simply was not what the wording claimed.
   *
   * Position is `extraction_readiness`'s job, and it labelled that same text `buried`.
   * Asking one question per property keeps both answerable.
   */
  answers_heading: {
    type: 'noul',
    instructions: 'The text under this heading answers what the heading asks or names.',
    criteria: {
      true: 'A reader looking for what the heading promises finds it in this text.',
      false:
        'The heading promises something this text never delivers, however far down you read.',
    },
  },
  self_contained: {
    type: 'noul',
    instructions:
      'This text is understandable on its own, quoted in isolation away from the rest of the page.',
    criteria: {
      true: 'Terms, subjects and references resolve within the text itself.',
      false:
        'It depends on surrounding context — unresolved "it", "this", "as mentioned above" — and would confuse a reader who saw only this.',
    },
  },
  extraction_readiness: {
    type: 'choice',
    instructions:
      'How usable is this section as a direct answer by a search or AI answering system?',
    criteria: {
      ready: 'A clear, self-contained, specific answer that could be quoted as-is.',
      needs_context: 'Contains the answer but requires surrounding context to make sense.',
      buried: 'The answer is present but obscured by digression or promotional filler.',
      absent: 'No substantive answer is present, only framing or navigation.',
    },
  },
  /**
   * Calibration scored this 2/4 — the weakest question in the catalogue, and the one
   * most visible to users, since it selects which suggestion they read.
   *
   * The failures were both option overlap rather than misunderstanding: it chose
   * `add_a_number` for a trust claim wanting a named customer, and `give_an_example`
   * for jargon needing a definition. Each option now says what makes it the answer AND
   * what rules it out, because a Choice is only as good as the separation between its
   * options.
   */
  improvement_type: {
    type: 'choice',
    instructions:
      'One change would help this text most. Which? Pick the single missing ingredient.',
    criteria: {
      add_a_number:
        'It claims a size, speed or amount but states no figure. THE MISSING THING IS A QUANTITY. Not this if the gap is trust or an undefined word.',
      cite_evidence:
        'It asks the reader to believe something about other people — who uses it, who trusts it, what results they got — with nobody named. THE MISSING THING IS AN ATTRIBUTABLE SOURCE: a named customer, a case study, a published result. Not this if a plain number would settle it.',
      define_the_term:
        'It uses a product name, acronym or piece of jargon that a newcomer would not recognise, and never says what it means. THE MISSING THING IS A DEFINITION. Not this if the term is clear and only an illustration is missing.',
      give_an_example:
        'The terms are all understandable, but it stays abstract and never shows the thing in use. THE MISSING THING IS A CONCRETE SCENARIO. Not this if a word first needs defining.',
      state_the_limit:
        'It describes only what works, with no mention of who it is wrong for or what it cannot do. THE MISSING THING IS A BOUNDARY.',
      already_specific:
        'Concrete, checkable and clear as written. No single change stands out.',
    },
  },
  promotional_intensity: {
    type: 'score',
    instructions: 'Rate how promotional the language is, as opposed to informative.',
    criteria: [
      'Purely factual and specific.',
      'Mostly factual with light positive framing.',
      'Balanced between informing and selling.',
      'Mostly promotional, with claims outweighing substance.',
      'Almost entirely superlatives and marketing language.',
    ],
  },
}

/**
 * Module 2 — Evidence & Trust, semantic half.
 *
 * The deterministic side finds claims, finds evidence, and measures the distance
 * between them. What it cannot judge is RELEVANCE: "we have 40,000 installs" is a real
 * figure sitting beside a speed claim it does nothing to support. Proximity is
 * measurable; whether the proof is about the claim is not.
 *
 * Asked only where evidence was actually found nearby — there is nothing to judge when
 * there is no evidence at all.
 */
export const EVIDENCE_QUESTIONS: Record<string, Question> = {
  evidence_supports_claim: {
    type: 'noul',
    instructions:
      'The supporting detail is evidence for THIS claim, not merely a nearby fact.',
    criteria: {
      true: 'The detail speaks to the same thing the claim asserts, so a sceptical reader would be satisfied by it.',
      false:
        'The detail is real but about something else — a different quality, a different metric — so it does not support this claim even though it sits beside it.',
    },
  },
}

/** Asked per candidate claim passage, against passage-scope state. */
export const PASSAGE_QUESTIONS: Record<string, Question> = {
  /**
   * Sharpened after calibration: "the settings screen lists every field you created" was
   * judged a claim at 0.83, and by the old wording — "capability, performance or
   * outcome" — it is one. But this question gates specificity scoring, so treating plain
   * description as a claim produces vague-claim findings on neutral text.
   *
   * What matters is whether a sceptical buyer would want proof. Nobody demands evidence
   * that a settings screen lists fields; they do demand it for "40% faster".
   */
  is_claim: {
    type: 'noul',
    instructions:
      'A sceptical buyer would want proof of this before believing it.',
    criteria: {
      true: 'It asserts a benefit, a result, a comparison or a level of quality — the kind of statement a competitor might dispute.',
      false:
        'It describes how something works or what it contains, neutrally. Factual, but nothing a buyer would demand evidence for.',
    },
  },
  claim_specificity: {
    type: 'score',
    instructions: 'Rate how specific and checkable the claim is.',
    criteria: [
      'Vague — no figures, scope or conditions ("dramatically better").',
      'Somewhat vague — direction given but unquantified.',
      'Partly specific — some detail, key terms undefined.',
      'Specific — quantified with stated scope.',
      'Fully specific — quantified, scoped and attributable to a source.',
    ],
  },
}
