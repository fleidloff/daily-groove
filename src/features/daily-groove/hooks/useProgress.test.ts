import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { Answer, Attempt, DailyResult } from '../types'
import type { ResultStore } from '../lib/storage'
import { useProgress } from './useProgress'

const TODAY = '2026-08-21'
const YESTERDAY = '2026-08-20'

const ANSWER: Answer = { root: 'C', flavour: 'Minor' }

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
    expect(result.current.streak).toBe(1)
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
    })
    // ...and the day is readable back through the hook, before any solve.
    expect(result.current.todayResult).toEqual({
      date: TODAY,
      answer: ANSWER,
      attempts: [first],
      solved: false,
    })
    // An unsolved day does not count toward the streak.
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
        attempts: [first],
        solved: false,
      })
    })
    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
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
        attempts: [winner],
        solved: true,
      })
    })

    expect(result.current.todayResult?.solved).toBe(true)
    expect(result.current.streak).toBe(1)
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
        attempts: [first],
        solved: false,
      })
    })

    expect(result.current.todayResult?.attempts).toEqual([first])
  })
})
