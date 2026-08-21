import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { DailyResult } from '../types'
import type { ResultStore } from '../lib/storage'
import { useProgress } from './useProgress'

const TODAY = '2026-08-21'

const todayResult: DailyResult = {
  date: TODAY,
  guesses: { scale: 'C minor', chord: 'Cm7' },
  correctness: { scale: true, chord: false },
}

const yesterdayResult: DailyResult = {
  date: '2026-08-20',
  guesses: { progression: 'Am–D–G' },
  correctness: { progression: true },
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

  it("loads today's existing result and derives streak/history (AC1, R3, R4)", async () => {
    const store = makeStore({
      get: vi.fn(async () => todayResult),
      getAll: vi.fn(async () => [yesterdayResult, todayResult]),
    })
    const { result } = renderHook(() => useProgress(TODAY, store))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.todayResult).toEqual(todayResult)
    // Both days qualify and are consecutive up to today → streak 2.
    expect(result.current.streak).toBe(2)
    // History is most-recent first.
    expect(result.current.history).toEqual([todayResult, yesterdayResult])
  })

  it('save writes through the store and updates local state (R1)', async () => {
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => {
      await result.current.save(todayResult)
    })

    expect(store.save).toHaveBeenCalledTimes(1)
    expect(store.save).toHaveBeenCalledWith(todayResult)
    expect(result.current.todayResult).toEqual(todayResult)
    expect(result.current.history).toEqual([todayResult])
    expect(result.current.streak).toBe(1)
  })
})
