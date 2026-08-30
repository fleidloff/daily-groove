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

// Calendar fixtures. 2026-08-17 is a Monday, so:
//   Mon 2026-08-17 · Tue 08-18 · Wed 08-19 · Thu 08-20 · Fri 08-21
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
})

describe('computeStreak — the anchor shift (R1, R2)', () => {
  // AC7 — nothing at all.
  it('is 0 when there are no results', () => {
    expect(computeStreak([], FRI)).toBe(0)
  })

  // R1 — solved today only.
  it('is 1 when today alone is solved', () => {
    expect(computeStreak([result(FRI, true)], FRI)).toBe(1)
  })

  // AC1 — the case this epic exists for: yesterday solved, today untouched.
  // Was previously asserted as 0 ("is 0 when today itself is absent"); the
  // anchor now falls back to yesterday, so the run survives the night.
  it('counts the run ending yesterday when today is untouched', () => {
    const results = [result(THU, true)]
    expect(computeStreak(results, FRI)).toBe(1)
  })

  // AC6 — today attempted but not solved is treated as "not finished yet",
  // not as a broken day. Previously asserted as 0.
  it('counts the run ending yesterday when today is attempted but unsolved', () => {
    const results = [result(THU, true), result(FRI, false, 2)]
    expect(computeStreak(results, FRI)).toBe(1)
  })

  // AC2 / R4 — the anchor moves onto today the moment today is solved, which
  // is what makes the badge advance with no reload.
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

  // AC3 — three consecutive solved days ending today.
  it('counts a longer run of consecutive solved days ending today', () => {
    const results = [result(WED, true), result(THU, true), result(FRI, true)]
    expect(computeStreak(results, FRI)).toBe(3)
  })

  // R1 — the same run seen the following morning, before today is played.
  it('counts Mon–Wed as 3 on an untouched Thursday', () => {
    const results = [result(MON, true), result(TUE, true), result(WED, true)]
    expect(computeStreak(results, THU)).toBe(3)
  })
})

describe('computeStreak — days that break the run (R3, R3a, R3b)', () => {
  // AC5 — a whole day missed. The anchor is Thursday, Thursday is absent, the
  // walk stops before it starts. The briefing's "1 day without trying clears
  // the streak", asserted rather than assumed.
  it('is 0 when Mon–Wed are solved but Thursday is missing and today is Friday', () => {
    const results = [result(MON, true), result(TUE, true), result(WED, true)]
    expect(computeStreak(results, FRI)).toBe(0)
  })

  // AC4 — the last solve was two days ago and nothing since.
  it('is 0 when the last solve was two days ago and nothing has happened since', () => {
    const results = [result(WED, true)]
    expect(computeStreak(results, FRI)).toBe(0)
  })

  // AC6a — the anchor shift is not a grace period: yesterday is a finished day,
  // and a finished day that was attempted but never solved still breaks the run.
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
      // Wednesday missing (gap)
      result(THU, true),
      result(FRI, true),
    ]
    expect(computeStreak(results, FRI)).toBe(2)
  })
})

describe('computeStreak — attempts and calendar edges (R3, R6)', () => {
  // AC6b — how long it took never decides qualification.
  it('counts today when it was solved on the fifth attempt', () => {
    expect(computeStreak([result(FRI, true, 5)], FRI)).toBe(1)
  })

  it('steps across a month boundary correctly', () => {
    const results = [result('2026-07-31', true), result('2026-08-01', true)]
    expect(computeStreak(results, '2026-08-01')).toBe(2)
  })

  // The anchor itself has to roll back over a month boundary: today is the 1st
  // and untouched, so the walk must start on the previous month's last day.
  it('rolls the anchor back across a month boundary when today is untouched', () => {
    const results = [result('2026-07-30', true), result('2026-07-31', true)]
    expect(computeStreak(results, '2026-08-01')).toBe(2)
  })

  // R5 / AC8 — computing is a pure read: the input array is never mutated and
  // there is no store to write to.
  it('does not mutate the results it is given', () => {
    const results = [result(THU, true), result(FRI, true)]
    const snapshot = JSON.parse(JSON.stringify(results))
    computeStreak(results, FRI)
    expect(results).toEqual(snapshot)
  })
})

// --- Epic 3 (feature-7): a day given up on ---------------------------------

describe('computeStreak — a given-up day (E3 R10, AC11)', () => {
  /** A day the player gave up on: unsolved, and flagged as revealed. */
  function revealed(date: string): DailyResult {
    return { ...result(date, false, 3), revealed: true }
  }

  // The streak never reads the flag: `isQualifying` keys on `solved` alone, so
  // giving up is judged exactly as any other unsolved day. If someone later
  // teaches `streak.ts` about `revealed`, these fail.
  it('does not qualify', () => {
    expect(isQualifying(revealed(WED))).toBe(false)
  })

  it('neither extends the run nor is skipped over', () => {
    const results = [result(WED, true), result(THU, true), revealed(FRI)]
    // The run ends at Thursday: today was given up on, so the anchor falls back
    // to yesterday and the walk counts Thursday and Wednesday — the revealed
    // day adds nothing, and does not act as a gap-free pass either.
    expect(computeStreak(results, FRI)).toBe(2)
  })

  it('breaks the run when it is in the past', () => {
    const results = [result(TUE, true), revealed(WED), result(THU, true)]
    // Thursday alone: a past day given up on ends the run where it stands,
    // exactly as a past day left unfinished does.
    expect(computeStreak(results, FRI)).toBe(1)
  })

  it('reads identically to the same day without the flag', () => {
    const withFlag = [result(THU, true), revealed(FRI)]
    const without = [result(THU, true), result(FRI, false, 3)]
    expect(computeStreak(withFlag, FRI)).toBe(computeStreak(without, FRI))
  })
})
