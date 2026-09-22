import { describe, it, expect } from 'vitest'
import { thresholdFor, choiceThreshold, optionCount, NOUL_THRESHOLD } from '../../src/semantic/thresholds'
import { isConfident } from '../../src/semantic/run'
import type { Answer } from '../../src/provider/types'

const noul = (v: number, c: number): Answer => ({ type: 'noul', noul: v, confidence: c })
const choice = (opts: number, c: number): Answer => ({
  type: 'choice', choice: 'a', confidence: c,
  probabilities: Object.fromEntries(Array.from({ length: opts }, (_, i) => [`o${i}`, 1 / opts])),
})
const score = (v: number, c: number): Answer => ({
  type: 'score', score: v, confidence: c,
  legend: { 0: 'a', 1: 'b', 2: 'c', 3: 'd', 4: 'e' },
})

describe('F28 per-primitive confidence thresholds', () => {
  it('holds a binary judgement to the configured bar', () => {
    expect(thresholdFor(noul(0.9, 0.8), 0.6)).toBe(0.6)
    expect(isConfident(noul(0.9, 0.8), 0.6)).toBe(true)
    expect(isConfident(noul(0.55, 0.1), 0.6)).toBe(false)
  })

  it('scales the bar down as a Choice gains options', () => {
    // A four-way split cannot be as peaked as a two-way one; one flat number
    // silently discarded correct answers.
    expect(choiceThreshold(2)).toBe(0.6)
    expect(choiceThreshold(4)).toBeCloseTo(0.5, 5)
    expect(choiceThreshold(6)).toBeGreaterThanOrEqual(0.35)
    expect(choiceThreshold(4)).toBeLessThan(choiceThreshold(2))
  })

  it('never drops the bar to where a guess would pass', () => {
    for (const n of [2, 3, 4, 5, 6, 8, 20]) {
      // Chance is 1/n; the bar must stay clearly above it.
      expect(choiceThreshold(n), `${n} options`).toBeGreaterThan(1 / n)
      expect(choiceThreshold(n)).toBeGreaterThanOrEqual(0.35)
    }
  })

  it('reads the option count from whatever the model returned', () => {
    expect(optionCount(choice(4, 0.5))).toBe(4)
    expect(optionCount(score(2, 0.5))).toBe(5)
    expect(optionCount(noul(0.9, 0.9))).toBe(2)
  })

  it('treats adjacent rubric levels as a legitimate disagreement', () => {
    expect(thresholdFor(score(2, 0.55), 0.6)).toBeLessThanOrEqual(0.5)
    expect(isConfident(score(2, 0.55), 0.6)).toBe(true)
  })

  it('lets an operator tighten the product overall', () => {
    // Raising the global value must still tighten noul, not be ignored.
    expect(thresholdFor(noul(0.9, 0.9), 0.9)).toBe(0.9)
    expect(isConfident(noul(0.9, 0.85), 0.9)).toBe(false)
  })

  it('keeps the documented default', () => {
    expect(NOUL_THRESHOLD).toBe(0.6)
  })
})
