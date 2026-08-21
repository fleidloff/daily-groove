import { describe, it, expect } from 'vitest'
import type { DailyResult } from '../types'
import { isQualifying, computeStreak } from './streak'

function result(date: string, correctness: DailyResult['correctness']): DailyResult {
  return { date, guesses: {}, correctness }
}

describe('isQualifying', () => {
  it('is true when at least one attempted attribute is correct', () => {
    expect(isQualifying(result('2026-08-21', { scale: true, chord: false }))).toBe(true)
  })

  it('is false when all attempted attributes are wrong', () => {
    expect(isQualifying(result('2026-08-21', { scale: false, chord: false }))).toBe(false)
  })

  it('is false when no attributes were attempted (empty correctness)', () => {
    expect(isQualifying(result('2026-08-21', {}))).toBe(false)
  })
})

describe('computeStreak', () => {
  it('is 0 when there are no results', () => {
    expect(computeStreak([], '2026-08-21')).toBe(0)
  })

  it('counts consecutive qualifying days up to today (AC3)', () => {
    const results = [
      result('2026-08-19', { scale: true }),
      result('2026-08-20', { chord: true }),
      result('2026-08-21', { progression: true }),
    ]
    expect(computeStreak(results, '2026-08-21')).toBe(3)
  })

  it('is 1 when only today qualifies', () => {
    expect(computeStreak([result('2026-08-21', { scale: true })], '2026-08-21')).toBe(1)
  })

  it('is 0 when today itself is absent, even with a prior run', () => {
    const results = [
      result('2026-08-19', { scale: true }),
      result('2026-08-20', { scale: true }),
    ]
    expect(computeStreak(results, '2026-08-21')).toBe(0)
  })

  it('is 0 when today is played but non-qualifying', () => {
    const results = [
      result('2026-08-20', { scale: true }),
      result('2026-08-21', { scale: false }),
    ]
    expect(computeStreak(results, '2026-08-21')).toBe(0)
  })

  it('stops at a gap day with no result (AC4)', () => {
    const results = [
      result('2026-08-18', { scale: true }),
      // 2026-08-19 missing (gap)
      result('2026-08-20', { scale: true }),
      result('2026-08-21', { scale: true }),
    ]
    expect(computeStreak(results, '2026-08-21')).toBe(2)
  })

  it('stops at a played-but-non-qualifying day (AC7)', () => {
    const results = [
      result('2026-08-18', { scale: true }),
      result('2026-08-19', { scale: false }), // played, non-qualifying
      result('2026-08-20', { scale: true }),
      result('2026-08-21', { scale: true }),
    ]
    expect(computeStreak(results, '2026-08-21')).toBe(2)
  })

  it('steps across a month boundary correctly', () => {
    const results = [
      result('2026-07-31', { scale: true }),
      result('2026-08-01', { scale: true }),
    ]
    expect(computeStreak(results, '2026-08-01')).toBe(2)
  })
})
