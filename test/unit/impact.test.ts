import { describe, it, expect } from 'vitest'
import { impactTier, compareByImpact, countOccurrences, TIER_LABEL, isTiered } from '../../src/assemble/impact'
import { allCheckIds } from '../../src/checks/registry'
import { CHECKS } from '../../src/assemble/checks'
import { STATIC_TEMPLATES } from '../../src/static/structure/templates'
import { LANGUAGE_TEMPLATES } from '../../src/static/language/signals'

const f = (checkId: string, confidence = 'high', id = checkId) => ({ checkId, id, confidence })
const sort = (items: ReturnType<typeof f>[]) => {
  const occ = countOccurrences(items)
  return [...items].sort((a, b) => compareByImpact(a, b, occ)).map((x) => x.checkId)
}

describe('SC-111 extraction impact ordering', () => {
  it('puts a page-blocking issue above everything else', () => {
    // A noindex tag makes every other finding on the page moot.
    expect(sort([f('long_sentences'), f('heavily_promotional'), f('meta_noindex')])[0])
      .toBe('meta_noindex')
  })

  it('ranks blocking a section above merely weakening content', () => {
    expect(sort([f('vague_claim'), f('answer_absent')])).toEqual(['answer_absent', 'vague_claim'])
  })

  it('ranks harder-to-extract above weaker-but-usable', () => {
    expect(sort([f('heavily_promotional'), f('no_structured_formats')]))
      .toEqual(['no_structured_formats', 'heavily_promotional'])
  })

  it('puts metadata housekeeping last', () => {
    expect(sort([f('no_meta_description'), f('answer_buried'), f('high_anaphora')]))
      .toEqual(['answer_buried', 'high_anaphora', 'no_meta_description'])
  })

  it('within a tier, an issue occurring more often comes first', () => {
    const items = [
      f('vague_claim', 'high', 'v1'),
      f('heavily_promotional', 'high', 'p1'),
      f('heavily_promotional', 'high', 'p2'),
      f('heavily_promotional', 'high', 'p3'),
    ]
    expect(sort(items)[0]).toBe('heavily_promotional')
  })

  it('breaks remaining ties by confidence', () => {
    const items = [f('vague_claim', 'low', 'a'), f('long_sentences', 'high', 'b')]
    const occ = countOccurrences(items)
    // Same tier, same count — the confident one wins.
    expect([...items].sort((x, y) => compareByImpact(x, y, occ))[0]!.id).toBe('b')
  })

  it('is deterministic for identical input', () => {
    const items = [f('a1', 'high', 'x'), f('a1', 'high', 'y'), f('b2', 'low', 'z')]
    expect(sort(items)).toEqual(sort(items))
  })

  it('assigns every known check a tier, and unknown ones the safe default', () => {
    const known = [
      ...CHECKS.map((c) => c.id),
      ...Object.keys(STATIC_TEMPLATES),
      ...Object.keys(LANGUAGE_TEMPLATES),
    ]
    for (const id of known) {
      const tier = impactTier(id)
      expect(tier, `${id} has no tier`).toBeGreaterThanOrEqual(0)
      expect(tier).toBeLessThanOrEqual(4)
      expect(TIER_LABEL[tier]).toBeTruthy()
    }
    // A check added later without a tier must not crash or jump the queue.
    expect(impactTier('some_future_check')).toBe(4)
  })

  it('does not simply reproduce the priority label', () => {
    // no_meta_description is "low" priority but so is vague_claim; impact separates them.
    // meta_noindex and heavily_promotional are both reachable as high/medium labels,
    // yet must not be adjacent in impact terms.
    expect(impactTier('meta_noindex')).toBeLessThan(impactTier('heavily_promotional'))
    expect(impactTier('answer_absent')).toBeLessThan(impactTier('no_meta_description'))
  })
})

describe('every check gets a tier on purpose', () => {
  it('leaves nothing to fall through to housekeeping by accident', () => {
    // Module 5's two checks landed on the default tier — "metadata and housekeeping" —
    // which sorted them below everything and cut them out of the plan entirely. An
    // unlisted id and a deliberately low-tier id looked identical until then.
    const missing = allCheckIds().filter((id) => !isTiered(id))
    expect(
      missing,
      `These checks have no impact tier. Add each to a table in src/assemble/impact.ts:\n  ${missing.join('\n  ')}`,
    ).toEqual([])
  })
})
