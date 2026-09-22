import type { Question } from '../provider/types'

/**
 * SC-109 — the module 1 question catalogue.
 *
 * Data, not code, so it is versioned and reviewable. Every readiness dimension is
 * already an enum or a rubric, which is exactly why a System One model fits: nothing
 * here needs free text.
 */

export const QUESTION_CATALOGUE_VERSION = '0.2.0'

/** Asked once per page, against page-scope state. */
export const PAGE_QUESTIONS: Record<string, Question> = {
  entity_clarity: {
    type: 'noul',
    instructions:
      'The primary organisation, product or service this page is about is named explicitly.',
    criteria: {
      true: 'A specific name is used, so a reader arriving cold knows who or what this is.',
      false:
        'The subject is referred to only obliquely — "we", "our platform", "the solution" — without naming it.',
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
  improvement_type: {
    type: 'choice',
    instructions:
      'If one change were made to this text to make it more useful to a reader and more quotable by an answering system, which change would help most?',
    criteria: {
      add_a_number:
        'It asserts scale, speed or quality without any figure. A number would make it checkable.',
      state_the_limit:
        'It describes only the happy path. Saying what it does not do, or who it is not for, would build more trust than more praise.',
      cite_evidence:
        'It makes a claim a reader would want proof of. A case study, benchmark, documentation link or named customer would support it.',
      give_an_example:
        'It stays abstract. A concrete example or use case would make it land.',
      define_the_term:
        'It uses jargon or a product name a newcomer would not recognise, without explaining it.',
      already_specific:
        'The text is already concrete and checkable; no single change stands out.',
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

/** Asked per candidate claim passage, against passage-scope state. */
export const PASSAGE_QUESTIONS: Record<string, Question> = {
  is_claim: {
    type: 'noul',
    instructions: 'This text makes a factual claim about capability, performance or outcome.',
    criteria: {
      true: 'It asserts something that could in principle be verified or falsified.',
      false: 'It is description, navigation, or opinion with nothing checkable asserted.',
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
