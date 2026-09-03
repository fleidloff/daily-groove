import { describe, it, expect } from 'vitest'
import type { Attempt, DailyResult } from '../../types'
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

const MON = '2026-08-17'
const TUE = '2026-08-18'
const WED = '2026-08-19'
const THU = '2026-08-20'
const FRI = '2026-08-21'

describe('isQualifying (R3, R3b)', () => {
  it('is true for a solved day, whatever the attempt count', () => {
    expect(isQualifying(result(WED, true, 1))).toBe(true)
    expect(isQualifying(result(WED, true, 5))).toBe(true)
  })

  it('is false for an unsolved day, however many attempts were spent', () => {
    expect(isQualifying(result(WED, false, 5))).toBe(false)
  })

  it('is false for a day with no attempts at all', () => {
    expect(isQualifying(result(WED, false, 0))).toBe(false)
  })

  it('qualifies a day solved on the seventh guess (F19 E1 R4, AC5)', () => {
    expect(isQualifying(result(FRI, true, 7))).toBe(true)
  })
})

describe('computeStreak — the anchor shift (R1, R2)', () => {
  it('is 0 when there are no results', () => {
    expect(computeStreak([], FRI)).toBe(0)
  })

  it('is 1 when today alone is solved', () => {
    expect(computeStreak([result(FRI, true)], FRI)).toBe(1)
  })

  it('counts the run ending yesterday when today is untouched', () => {
    const results = [result(THU, true)]
    expect(computeStreak(results, FRI)).toBe(1)
  })

  it('counts the run ending yesterday when today is attempted but unsolved', () => {
    const results = [result(THU, true), result(FRI, false, 2)]
    expect(computeStreak(results, FRI)).toBe(1)
  })

  it('moves the anchor onto today when today is solved, taking the count from 1 to 2', () => {
    const beforeSolving = [result(THU, true)]
    expect(computeStreak(beforeSolving, FRI)).toBe(1)

    const afterSolving = [...beforeSolving, result(FRI, true)]
    expect(computeStreak(afterSolving, FRI)).toBe(2)
  })

  it('is 2 when yesterday and today were both solved', () => {
    const results = [result(THU, true, 3), result(FRI, true, 1)]
    expect(computeStreak(results, FRI)).toBe(2)
  })

  it('counts a longer run of consecutive solved days ending today', () => {
    const results = [result(WED, true), result(THU, true), result(FRI, true)]
    expect(computeStreak(results, FRI)).toBe(3)
  })

  it('counts Mon–Wed as 3 on an untouched Thursday', () => {
    const results = [result(MON, true), result(TUE, true), result(WED, true)]
    expect(computeStreak(results, THU)).toBe(3)
  })

  it('counts a seventh-guess solve as one more than yesterday (F19 E1 R4, AC5)', () => {
    expect(computeStreak([result(THU, true)], FRI)).toBe(1)
    expect(computeStreak([result(THU, true), result(FRI, true, 7)], FRI)).toBe(2)
  })

  it('reads 1 when today is solved and yesterday has no result at all (F19 E1 R5, AC7)', () => {
    expect(computeStreak([result(FRI, true)], FRI)).toBe(1)
    expect(computeStreak([result(WED, true), result(FRI, true)], FRI)).toBe(1)
  })
})

describe('computeStreak — days that break the run (R3, R3a, R3b)', () => {
  it('is 0 when Mon–Wed are solved but Thursday is missing and today is Friday', () => {
    const results = [result(MON, true), result(TUE, true), result(WED, true)]
    expect(computeStreak(results, FRI)).toBe(0)
  })

  it('is 0 when the last solve was two days ago and nothing has happened since', () => {
    const results = [result(WED, true)]
    expect(computeStreak(results, FRI)).toBe(0)
  })

  it('is 0 when the last solve was two days ago and yesterday was attempted but unsolved', () => {
    const results = [result(WED, true), result(THU, false, 4)]
    expect(computeStreak(results, FRI)).toBe(0)
  })

  it('is 1 when yesterday was left unsolved and today is solved', () => {
    const results = [result(THU, false, 6), result(FRI, true, 2)]
    expect(computeStreak(results, FRI)).toBe(1)
  })

  it('stops at a gap day with no result', () => {
    const results = [
      result(TUE, true),
      result(THU, true),
      result(FRI, true),
    ]
    expect(computeStreak(results, FRI)).toBe(2)
  })

  it('reads 1 when yesterday was guessed at, never solved and never given up (F19 E1 R5, AC8)', () => {
    const yesterday = result(THU, false, 6)
    expect(yesterday.revealed).toBeUndefined()
    expect(computeStreak([yesterday, result(FRI, true, 2)], FRI)).toBe(1)
  })

  it('never restores a run an unsolved day broke (F19 E1 R6)', () => {
    const before = [result(MON, true), result(TUE, true), result(WED, true)]
    expect(computeStreak([...before, result(THU, false, 2)], THU)).toBe(3)
    expect(
      computeStreak([...before, result(THU, false, 2), result(FRI, true)], FRI),
    ).toBe(1)
  })
})

describe('computeStreak — attempts and calendar edges (R3, R6)', () => {
  it('counts today when it was solved on the fifth attempt', () => {
    expect(computeStreak([result(FRI, true, 5)], FRI)).toBe(1)
  })

  it('steps across a month boundary correctly', () => {
    const results = [result('2026-07-31', true), result('2026-08-01', true)]
    expect(computeStreak(results, '2026-08-01')).toBe(2)
  })

  it('rolls the anchor back across a month boundary when today is untouched', () => {
    const results = [result('2026-07-30', true), result('2026-07-31', true)]
    expect(computeStreak(results, '2026-08-01')).toBe(2)
  })

  it('does not mutate the results it is given', () => {
    const results = [result(THU, true), result(FRI, true)]
    const snapshot = JSON.parse(JSON.stringify(results))
    computeStreak(results, FRI)
    expect(results).toEqual(snapshot)
  })
})

describe('computeStreak — a given-up day (E3 R10, AC11)', () => {
  function revealed(date: string): DailyResult {
    return { ...result(date, false, 3), revealed: true }
  }

  it('does not qualify', () => {
    expect(isQualifying(revealed(WED))).toBe(false)
  })

  it('ends the run on the day it happens', () => {
    const results = [result(WED, true), result(THU, true), revealed(FRI)]
    expect(computeStreak(results, FRI)).toBe(0)
  })

  it('breaks the run when it is in the past', () => {
    const results = [result(TUE, true), revealed(WED), result(THU, true)]
    expect(computeStreak(results, FRI)).toBe(1)
  })

  it('a given-up day ends the run now; the same day left unfinished waits until tomorrow', () => {
    expect(computeStreak([result(THU, true), revealed(FRI)], FRI)).toBe(0)
    expect(computeStreak([result(THU, true), result(FRI, false, 3)], FRI)).toBe(1)
  })

  it('reads 0 when a run ending yesterday meets a day given up on (F19 E1 R5, AC6)', () => {
    const results = [result(WED, true), result(THU, true), revealed(FRI)]
    expect(computeStreak(results, FRI)).toBe(0)
  })

  it('keeps yesterday’s run while today is unopened or still playable (F19 E1 R5)', () => {
    const run = [result(WED, true), result(THU, true)]
    expect(computeStreak(run, FRI)).toBe(2)
    expect(computeStreak([...run, result(FRI, false, 2)], FRI)).toBe(2)
    expect(computeStreak([...run, revealed(FRI)], FRI)).toBe(0)
  })
})
