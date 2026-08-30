import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { Answer, Attempt, DailyResult } from '../types'
import type { ResultStore } from '../lib/persistence/storage'
import { useProgress } from './useProgress'

const TODAY = '2026-08-21'
const YESTERDAY = '2026-08-20'

const ANSWER: Answer = { root: 'C', flavour: 'Minor' }

/**
 * The groove today played. `DayProgress` carries it so the record remembers
 * which audio the day was played against (E5 R7): resolving by date alone
 * re-points at a different groove the moment the catalogue grows.
 */
const GROOVE_ID = 'groove-03'

function attempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    root: 'C',
    flavour: 'Dorian',
    correct: false,
    rootMatched: true,
    flavourMatched: false,
    ...overrides,
  }
}

const todayResult: DailyResult = {
  date: TODAY,
  answer: ANSWER,
  attempts: [attempt({ correct: true, flavourMatched: true, flavour: 'Minor' })],
  solved: true,
}

const yesterdayResult: DailyResult = {
  date: YESTERDAY,
  answer: { root: 'G', flavour: 'Dorian' },
  attempts: [
    attempt({ root: 'G', flavour: 'Dorian', correct: true, flavourMatched: true }),
  ],
  solved: true,
}

/** A fully-controllable mock `ResultStore`. */
function makeStore(overrides: Partial<ResultStore> = {}): ResultStore {
  return {
    get: vi.fn(async () => null),
    getAll: vi.fn(async () => []),
    save: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('useProgress', () => {
  it('empty store → loaded, streak 0, empty history, no today result (AC5)', async () => {
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    // Still 0 under the anchor-shift rule (Epic 3): today is unsolved so the
    // anchor falls back to yesterday, and yesterday is absent too.
    expect(result.current.streak).toBe(0)
    expect(result.current.history).toEqual([])
    expect(result.current.todayResult).toBeNull()
  })

  it("loads today's existing result and derives streak/history (R3, R7, AC6)", async () => {
    const store = makeStore({
      get: vi.fn(async () => todayResult),
      getAll: vi.fn(async () => [yesterdayResult, todayResult]),
    })
    const { result } = renderHook(() => useProgress(TODAY, store))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.todayResult).toEqual(todayResult)
    // Both days were solved and are consecutive up to today → streak 2 (AC6).
    // Unchanged by the anchor-shift rule (Epic 3): today qualifies, so the
    // anchor stays on today and the walk is the one it always was.
    expect(result.current.streak).toBe(2)
    // History is most-recent first.
    expect(result.current.history).toEqual([todayResult, yesterdayResult])
  })

  it('an unsolved yesterday breaks the streak (R7, AC6)', async () => {
    const missed: DailyResult = { ...yesterdayResult, solved: false }
    const store = makeStore({
      get: vi.fn(async () => todayResult),
      getAll: vi.fn(async () => [missed, todayResult]),
    })
    const { result } = renderHook(() => useProgress(TODAY, store))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    // Unchanged by the anchor-shift rule (Epic 3): today is solved, so the
    // anchor is today; the walk then stops at an unsolved yesterday. The shift
    // is not a grace period — a past day left unsolved still breaks the run.
    expect(result.current.streak).toBe(1)
  })

  it('derives the streak without writing anything (E3 R5, AC8)', async () => {
    // R5 keeps the streak derived, never persisted. Before this, nothing
    // asserted it: a refactor that handed `computeStreak` a store and cached
    // its result would satisfy every other streak test in the suite.
    const store = makeStore({
      get: vi.fn(async () => todayResult),
      getAll: vi.fn(async () => [yesterdayResult, todayResult]),
    })
    const { result } = renderHook(() => useProgress(TODAY, store))

    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.streak).toBe(2)
    expect(store.save).not.toHaveBeenCalled()
  })

  // --- C1: the day's record is written after every check, not only on a solve

  it('records the first wrong attempt as a stored record for today (R2, AC1)', async () => {
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    const first = attempt()
    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [first],
        solved: false,
      })
    })

    expect(store.save).toHaveBeenCalledTimes(1)
    expect(store.save).toHaveBeenCalledWith({
      date: TODAY,
      answer: ANSWER,
      attempts: [first],
      solved: false,
      grooveId: GROOVE_ID,
    })
    // ...and the day is readable back through the hook, before any solve.
    expect(result.current.todayResult).toEqual({
      date: TODAY,
      answer: ANSWER,
      attempts: [first],
      solved: false,
      grooveId: GROOVE_ID,
    })
    // An unsolved day does not count toward the streak. Still 0 under the
    // anchor-shift rule (Epic 3): the anchor falls back to yesterday, and this
    // fixture has no yesterday to find.
    expect(result.current.streak).toBe(0)
  })

  it('rewrites the day on each further attempt rather than adding a record (R2)', async () => {
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    const first = attempt()
    const second = attempt({ flavour: 'Lydian' })

    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [first],
        solved: false,
      })
    })
    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [first, second],
        solved: false,
      })
    })

    expect(store.save).toHaveBeenCalledTimes(2)
    expect(result.current.todayResult?.attempts).toEqual([first, second])
    expect(result.current.history).toHaveLength(1)
  })

  it('a solving attempt marks the day solved and starts the streak (R2, R7)', async () => {
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    const winner = attempt({ flavour: 'Minor', correct: true, flavourMatched: true })
    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [winner],
        solved: true,
      })
    })

    expect(result.current.todayResult?.solved).toBe(true)
    // Unchanged by the anchor-shift rule (Epic 3): solving today puts the
    // anchor back on today, and there is no yesterday to extend the run.
    expect(result.current.streak).toBe(1)
  })

  it('a solve advances the streak already on screen, with no remount (R4, AC2)', async () => {
    // Arriving the morning after a solve: yesterday is in the store, today is
    // untouched. The anchor shift is what makes this 1 rather than 0 (Epic 3).
    const store = makeStore({
      getAll: vi.fn(async () => [yesterdayResult]),
    })
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.todayResult).toBeNull()
    expect(result.current.streak).toBe(1)

    const winner = attempt({ flavour: 'Minor', correct: true, flavourMatched: true })
    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [winner],
        solved: true,
      })
    })

    // Same mounted hook — no remount, no reload. The streak is a derivation over
    // the result set that `recordAttempt` just updated, so the badge's number
    // moves 1 → 2 in place (R4, AC2).
    expect(result.current.streak).toBe(2)
  })

  // --- Epic 5: the record remembers the groove it played --------------------

  it('writes the day with the id of the groove it played (E5 R7, AC7)', async () => {
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    const first = attempt()
    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        attempts: [first],
        solved: false,
        grooveId: 'groove-03',
      })
    })

    expect(store.save).toHaveBeenCalledTimes(1)
    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({ date: TODAY, grooveId: 'groove-03' }),
    )
    expect(result.current.todayResult?.grooveId).toBe('groove-03')
  })

  it('carries the groove id through to the history it derives (E5 R7, AC7)', async () => {
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        attempts: [attempt()],
        solved: false,
        grooveId: 'groove-11',
      })
    })

    expect(result.current.history.map((r) => r.grooveId)).toEqual(['groove-11'])
  })

  it('exposes no write path replay could reach (E5 R9, AC11)', async () => {
    // A structural guard, not a behavioural one: replay must never gain a way
    // to touch the record, so the hook's surface is pinned. A new mutator here
    // is a deliberate decision, and this assertion is where it gets made.
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(Object.keys(result.current).sort()).toEqual([
      'history',
      'loaded',
      'recordAttempt',
      'streak',
      'todayResult',
    ])
    // The one function on the surface is the check path, not a playback path.
    const functions = Object.entries(result.current)
      .filter(([, value]) => typeof value === 'function')
      .map(([key]) => key)
    expect(functions).toEqual(['recordAttempt'])
  })

  it('a write that throws still leaves the guess in the session (R6, AC5)', async () => {
    const store = makeStore({
      save: vi.fn(async () => {
        throw new Error('quota exceeded')
      }),
    })
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    const first = attempt()
    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [first],
        solved: false,
      })
    })

    expect(result.current.todayResult?.attempts).toEqual([first])
  })
})
