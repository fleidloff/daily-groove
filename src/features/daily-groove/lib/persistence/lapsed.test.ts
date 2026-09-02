import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import type { Attempt, DailyResult } from '../../types'
import { isNewOrLapsed, LAPSE_DAYS } from './lapsed'

function attempt(correct: boolean): Attempt {
  return {
    root: 'C',
    flavour: 'Dorian',
    correct,
    rootMatched: correct,
    flavourMatched: correct,
  }
}

function result(
  date: string,
  extra: Partial<Pick<DailyResult, 'solved' | 'revealed'>> = {},
): DailyResult {
  const solved = extra.solved ?? true
  return {
    date,
    answer: { root: 'C', flavour: 'Dorian' },
    attempts: [attempt(solved)],
    solved,
    ...extra,
  }
}

const TODAY = '2026-08-31'

describe('LAPSE_DAYS', () => {
  it('is 31 days — the line "longer than a month" is drawn at', () => {
    expect(LAPSE_DAYS).toBe(31)
  })
})

describe('isNewOrLapsed — a player with nothing saved (R1, R15, AC1)', () => {
  it('is true for no results at all', () => {
    expect(isNewOrLapsed([], TODAY)).toBe(true)
  })
})

describe('isNewOrLapsed — thirty-one days is the line (R2, R3, AC4)', () => {
  const cases: Array<{
    name: string
    today: string
    date: string
    expected: boolean
  }> = [
    { name: 'one day back', today: TODAY, date: '2026-08-30', expected: false },
    { name: 'exactly 31 days back', today: TODAY, date: '2026-07-31', expected: false },
    { name: '32 days back', today: TODAY, date: '2026-07-30', expected: true },
    { name: '400 days back', today: TODAY, date: '2025-07-27', expected: true },
    {
      name: 'a February that is over a calendar month back but only 31 days',
      today: '2026-03-04',
      date: '2026-02-01',
      expected: false,
    },
    {
      name: 'one day further back across the same February',
      today: '2026-03-04',
      date: '2026-01-31',
      expected: true,
    },
    {
      name: 'exactly 31 days back across the new year',
      today: '2026-01-05',
      date: '2025-12-05',
      expected: false,
    },
    {
      name: '32 days back across the new year',
      today: '2026-01-05',
      date: '2025-12-04',
      expected: true,
    },
  ]

  for (const { name, today, date, expected } of cases) {
    it(`is ${expected} for a single record ${name} (${date} vs ${today})`, () => {
      expect(isNewOrLapsed([result(date)], today)).toBe(expected)
    })
  }

  it('judges the newest record, not the oldest', () => {
    expect(isNewOrLapsed([result('2024-01-01'), result('2026-08-30')], TODAY)).toBe(false)
    expect(isNewOrLapsed([result('2026-08-30'), result('2024-01-01')], TODAY)).toBe(false)
  })
})

describe('isNewOrLapsed — a day you lost still counts as a visit (R12, AC12)', () => {
  it('is false for a single unsolved record dated yesterday', () => {
    expect(isNewOrLapsed([result('2026-08-30', { solved: false })], TODAY)).toBe(false)
  })

  it('is false for a single revealed record dated yesterday', () => {
    expect(
      isNewOrLapsed([result('2026-08-30', { solved: false, revealed: true })], TODAY),
    ).toBe(false)
  })

  it('is false when the newest record is recent but unsolved, behind an older solved one', () => {
    const results = [
      result('2026-01-15', { solved: true }),
      result('2026-08-30', { solved: false }),
    ]
    expect(isNewOrLapsed(results, TODAY)).toBe(false)
  })
})

describe('isNewOrLapsed — the rule touches no storage (R13)', () => {
  const source = readFileSync(
    join(process.cwd(), 'src/features/daily-groove/lib/persistence/lapsed.ts'),
    'utf8',
  )

  it('names neither localStorage nor a daily-groove storage key', () => {
    expect(source).not.toContain('localStorage')
    expect(source).not.toContain('daily-groove:')
  })
})
