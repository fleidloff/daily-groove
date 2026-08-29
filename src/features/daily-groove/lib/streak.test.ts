import { describe, it, expect } from 'vitest'
import type { Attempt, DailyResult } from '../types'
import { isQualifying, computeStreak } from './streak'

function attempt(correct: boolean): Attempt {
  return {
    root: 'C',
    flavour: 'Dorian',
    correct,
    rootMatched: correct,
    flavourMatched: correct,
  }
}

function result(date: string, solved: boolean, tries = 1): DailyResult {
  const attempts: Attempt[] = []
  for (let i = 0; i < tries; i += 1) {
    attempts.push(attempt(solved && i === tries - 1))
  }
  return {
    date,
    answer: { root: 'C', flavour: 'Dorian' },
    attempts,
    solved,
  }
}

describe('isQualifying (R7, AC6)', () => {
  it('is true for a solved day, whatever the attempt count', () => {
    expect(isQualifying(result('2026-08-21', true, 1))).toBe(true)
    expect(isQualifying(result('2026-08-21', true, 5))).toBe(true)
  })

  it('is false for an unsolved day, however many attempts were spent', () => {
    expect(isQualifying(result('2026-08-21', false, 5))).toBe(false)
  })

  it('is false for a day with no attempts at all', () => {
    expect(isQualifying(result('2026-08-21', false, 0))).toBe(false)
  })
})

describe('computeStreak (R7, AC6)', () => {
  it('is 0 when there are no results', () => {
    expect(computeStreak([], '2026-08-21')).toBe(0)
  })

  it('is 2 when yesterday and today were both solved', () => {
    const results = [result('2026-08-20', true, 3), result('2026-08-21', true, 1)]
    expect(computeStreak(results, '2026-08-21')).toBe(2)
  })

  it('is 1 when yesterday was left unsolved and today is solved', () => {
    const results = [result('2026-08-20', false, 6), result('2026-08-21', true, 2)]
    expect(computeStreak(results, '2026-08-21')).toBe(1)
  })

  it('counts a longer run of consecutive solved days', () => {
    const results = [
      result('2026-08-19', true),
      result('2026-08-20', true),
      result('2026-08-21', true),
    ]
    expect(computeStreak(results, '2026-08-21')).toBe(3)
  })

  it('is 0 when today itself is absent, even with a prior run', () => {
    const results = [result('2026-08-19', true), result('2026-08-20', true)]
    expect(computeStreak(results, '2026-08-21')).toBe(0)
  })

  it('is 0 when today is played but unsolved', () => {
    const results = [result('2026-08-20', true), result('2026-08-21', false, 6)]
    expect(computeStreak(results, '2026-08-21')).toBe(0)
  })

  it('stops at a gap day with no result', () => {
    const results = [
      result('2026-08-18', true),
      // 2026-08-19 missing (gap)
      result('2026-08-20', true),
      result('2026-08-21', true),
    ]
    expect(computeStreak(results, '2026-08-21')).toBe(2)
  })

  it('steps across a month boundary correctly', () => {
    const results = [result('2026-07-31', true), result('2026-08-01', true)]
    expect(computeStreak(results, '2026-08-01')).toBe(2)
  })
})
