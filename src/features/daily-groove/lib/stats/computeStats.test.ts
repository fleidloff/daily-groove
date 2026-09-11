import { describe, it, expect } from 'vitest'
import type { Attempt, DailyResult, Flavour } from '../../types'
import type { Distribution } from './types'
import { computeStats } from './computeStats'

const TODAY = '2026-09-11'
const MISS: Flavour = 'Locrian'

function guesses(count: number, flavour: Flavour, firstTry: boolean, solved: boolean): Attempt[] {
  return Array.from({ length: count }, (_, i) => {
    const isLast = i === count - 1
    const named = (i === 0 && firstTry) || (isLast && solved)
    return {
      root: 'G',
      flavour: named ? flavour : MISS,
      correct: isLast && solved,
      rootMatched: isLast && solved,
      flavourMatched: named,
    }
  })
}

function solvedIn(
  date: string,
  count: number,
  options: { flavour?: Flavour; firstTry?: boolean } = {},
): DailyResult {
  const flavour = options.flavour ?? 'Dorian'
  return {
    date,
    answer: { root: 'G', flavour },
    attempts: guesses(count, flavour, options.firstTry ?? count === 1, true),
    solved: true,
  }
}

function revealedAfter(
  date: string,
  count: number,
  options: { flavour?: Flavour; firstTry?: boolean } = {},
): DailyResult {
  const flavour = options.flavour ?? 'Dorian'
  return {
    date,
    answer: { root: 'G', flavour },
    attempts: guesses(count, flavour, options.firstTry ?? false, false),
    solved: false,
    revealed: true,
  }
}

function sum(distribution: Distribution): number {
  return Object.values(distribution).reduce((total, n) => total + n, 0)
}

describe('computeStats — the counts', () => {
  it('counts every saved day in puzzlesPlayed', () => {
    const results = [
      solvedIn('2026-09-11', 2),
      solvedIn('2026-09-10', 4),
      revealedAfter('2026-09-09', 3),
    ]

    expect(computeStats(results, TODAY).puzzlesPlayed).toBe(3)
  })

  it('buckets a 3-attempt solve under 3', () => {
    const stats = computeStats([solvedIn('2026-09-11', 3)], TODAY)

    expect(stats.attempts.all['3']).toBe(1)
  })

  it('buckets a 9-attempt solve under 6+', () => {
    const stats = computeStats([solvedIn('2026-09-11', 9)], TODAY)

    expect(stats.attempts.all['6+']).toBe(1)
    expect(stats.attempts.all['5']).toBe(0)
  })

  it('buckets a revealed day under revealed, whatever its attempt count', () => {
    const stats = computeStats(
      [revealedAfter('2026-09-11', 2), revealedAfter('2026-09-10', 8)],
      TODAY,
    )

    expect(stats.attempts.all.revealed).toBe(2)
    expect(stats.attempts.all['2']).toBe(0)
    expect(stats.attempts.all['6+']).toBe(0)
  })

  it('buckets a 6-attempt solve under 6+ and a 5-attempt solve under 5', () => {
    const stats = computeStats(
      [solvedIn('2026-09-11', 6), solvedIn('2026-09-10', 5)],
      TODAY,
    )

    expect(stats.attempts.all['6+']).toBe(1)
    expect(stats.attempts.all['5']).toBe(1)
  })

  it('sums the all buckets to puzzlesPlayed', () => {
    const results = [
      solvedIn('2026-09-11', 1),
      solvedIn('2026-09-10', 3),
      solvedIn('2026-09-09', 7),
      revealedAfter('2026-09-08', 4),
      revealedAfter('2026-09-07', 0),
    ]

    const stats = computeStats(results, TODAY)

    expect(stats.puzzlesPlayed).toBe(5)
    expect(sum(stats.attempts.all)).toBe(stats.puzzlesPlayed)
  })

  it('counts solved and revealed as two separate counts', () => {
    const results = [
      solvedIn('2026-09-11', 2),
      solvedIn('2026-09-10', 3),
      revealedAfter('2026-09-09', 4),
    ]

    const stats = computeStats(results, TODAY)

    expect(stats.solved).toBe(2)
    expect(stats.revealed).toBe(1)
  })

  it('reports zeroes across every bucket for no results at all', () => {
    const stats = computeStats([], TODAY)

    expect(stats.puzzlesPlayed).toBe(0)
    expect(stats.solved).toBe(0)
    expect(stats.revealed).toBe(0)
    expect(stats.attempts.all).toEqual({
      '1': 0,
      '2': 0,
      '3': 0,
      '4': 0,
      '5': 0,
      '6+': 0,
      revealed: 0,
    })
  })
})

describe('computeStats — the last7 window', () => {
  const SIX_DAYS_BACK = '2026-09-05'
  const SEVEN_DAYS_BACK = '2026-09-04'
  const EIGHT_DAYS_BACK = '2026-09-03'

  it('leaves a result dated eight days back out of last7 while keeping it in all', () => {
    const stats = computeStats([solvedIn(EIGHT_DAYS_BACK, 2)], TODAY)

    expect(stats.attempts.all['2']).toBe(1)
    expect(stats.attempts.last7['2']).toBe(0)
    expect(sum(stats.attempts.last7)).toBe(0)
  })

  it('keeps the boundary day — six days back — inside last7', () => {
    const stats = computeStats([solvedIn(SIX_DAYS_BACK, 2)], TODAY)

    expect(stats.attempts.last7['2']).toBe(1)
  })

  it('leaves seven days back out, so the window is seven days including today', () => {
    const stats = computeStats([solvedIn(SEVEN_DAYS_BACK, 2)], TODAY)

    expect(stats.attempts.last7['2']).toBe(0)
    expect(stats.attempts.all['2']).toBe(1)
  })

  it('keeps today itself inside last7', () => {
    const stats = computeStats([solvedIn(TODAY, 1)], TODAY)

    expect(stats.attempts.last7['1']).toBe(1)
  })

  it('sums the last7 buckets to the number of days inside the window', () => {
    const results = [
      solvedIn(TODAY, 1),
      solvedIn(SIX_DAYS_BACK, 3),
      revealedAfter(SEVEN_DAYS_BACK, 4),
      solvedIn(EIGHT_DAYS_BACK, 2),
    ]

    const stats = computeStats(results, TODAY)

    expect(sum(stats.attempts.last7)).toBe(2)
    expect(sum(stats.attempts.all)).toBe(4)
  })

  it('computes the window start across a month boundary', () => {
    const stats = computeStats(
      [solvedIn('2026-08-28', 2), solvedIn('2026-08-26', 2)],
      '2026-09-02',
    )

    expect(stats.attempts.last7['2']).toBe(1)
    expect(stats.attempts.all['2']).toBe(2)
  })

  it('leaves puzzlesPlayed, solved and revealed on all data, not the window', () => {
    const results = [solvedIn(TODAY, 1), revealedAfter(EIGHT_DAYS_BACK, 3)]

    const stats = computeStats(results, TODAY)

    expect(stats.puzzlesPlayed).toBe(2)
    expect(stats.solved).toBe(1)
    expect(stats.revealed).toBe(1)
  })
})

describe('computeStats — the streak', () => {
  it('counts the run of solved days ending today', () => {
    const stats = computeStats(
      [solvedIn('2026-09-11', 3), solvedIn('2026-09-10', 2), solvedIn('2026-09-09', 1)],
      '2026-09-11',
    )
    expect(stats.streak).toBe(3)
  })

  it('stops at the first day with no result', () => {
    const stats = computeStats(
      [solvedIn('2026-09-11', 3), solvedIn('2026-09-08', 2)],
      '2026-09-11',
    )
    expect(stats.streak).toBe(1)
  })

  it('is zero for no results at all', () => {
    expect(computeStats([], '2026-09-11').streak).toBe(0)
  })
})
