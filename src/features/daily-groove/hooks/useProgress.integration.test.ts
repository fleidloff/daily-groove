import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { Answer, Attempt, DailyResult } from '../types'
import { createLocalStore } from '../lib/storage'
import { isoDate } from '../lib/selectGroove'
import { useProgress } from './useProgress'

// Integration: exercise useProgress against the REAL createLocalStore over the
// shimmed jsdom localStorage (cleared before each test by vitest.setup.ts). An
// attempt recorded in one "session" must survive a reload — a brand-new store
// instance over the same storage (R2, R3, AC1).
describe('useProgress + createLocalStore (real storage)', () => {
  const ANSWER: Answer = { root: 'C', flavour: 'Minor' }
  /** The groove the day was played against — persisted with the record (R7). */
  const GROOVE_ID = 'groove-05'

  const miss: Attempt = {
    root: 'C',
    flavour: 'Dorian',
    correct: false,
    rootMatched: true,
    flavourMatched: false,
  }

  it('an attempt recorded mid-game survives a remount with a fresh store (R2, R3, AC1)', async () => {
    const today = isoDate(new Date())

    // First session: one wrong guess, recorded as it happens.
    const firstStore = createLocalStore()
    const first = renderHook(() => useProgress(today, firstStore))
    await waitFor(() => expect(first.result.current.loaded).toBe(true))
    await act(async () => {
      await first.result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [miss],
        solved: false,
      })
    })
    first.unmount()

    // Second session: a brand-new store over the same localStorage ("reload").
    const secondStore = createLocalStore()
    const second = renderHook(() => useProgress(today, secondStore))
    await waitFor(() => expect(second.result.current.loaded).toBe(true))

    const expected: DailyResult = {
      date: today,
      answer: ANSWER,
      attempts: [miss],
      solved: false,
      grooveId: GROOVE_ID,
    }
    expect(second.result.current.todayResult).toEqual(expected)
    // Unsolved, so it does not build the streak. Still 0 under the anchor-shift
    // rule (Epic 3): an unsolved today moves the anchor to yesterday, and this
    // fixture has no yesterday record for the walk to find.
    expect(second.result.current.streak).toBe(0)
    expect(second.result.current.history).toEqual([expected])
  })

  it('the groove id survives the reload with the rest of the record (E5 R7, R8, AC7, AC9)', async () => {
    const today = isoDate(new Date())

    const firstStore = createLocalStore()
    const first = renderHook(() => useProgress(today, firstStore))
    await waitFor(() => expect(first.result.current.loaded).toBe(true))
    await act(async () => {
      await first.result.current.recordAttempt({
        answer: ANSWER,
        grooveId: 'groove-09',
        attempts: [miss],
        solved: false,
      })
    })
    first.unmount()

    const secondStore = createLocalStore()
    const second = renderHook(() => useProgress(today, secondStore))
    await waitFor(() => expect(second.result.current.loaded).toBe(true))

    // The id is what makes the day replayable after the catalogue grows: the
    // date alone would re-resolve to some other groove (E5 AC10).
    expect(second.result.current.todayResult?.grooveId).toBe('groove-09')
    expect(second.result.current.history[0].grooveId).toBe('groove-09')
    expect(second.result.current.todayResult?.attempts).toEqual([miss])
  })

  it('a record already in storage without a groove id still loads (E5 R8, AC8)', async () => {
    const today = isoDate(new Date())
    // Written the way a pre-Epic-5 session left it: no groove id at all.
    localStorage.setItem(
      'daily-groove:v2:results',
      JSON.stringify({
        version: 2,
        byDate: {
          [today]: {
            date: today,
            answer: ANSWER,
            attempts: [miss],
            solved: false,
          },
        },
      }),
    )

    const store = createLocalStore()
    const { result } = renderHook(() => useProgress(today, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.todayResult).toEqual({
      date: today,
      answer: ANSWER,
      attempts: [miss],
      solved: false,
    })
    expect(result.current.todayResult?.grooveId).toBeUndefined()
  })

  it('a solved day survives the reload and counts toward the streak (R4, R7)', async () => {
    const today = isoDate(new Date())
    const winner: Attempt = {
      root: 'C',
      flavour: 'Minor',
      correct: true,
      rootMatched: true,
      flavourMatched: true,
    }

    const firstStore = createLocalStore()
    const first = renderHook(() => useProgress(today, firstStore))
    await waitFor(() => expect(first.result.current.loaded).toBe(true))
    await act(async () => {
      await first.result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [miss],
        solved: false,
      })
    })
    await act(async () => {
      await first.result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [miss, winner],
        solved: true,
      })
    })
    first.unmount()

    const secondStore = createLocalStore()
    const second = renderHook(() => useProgress(today, secondStore))
    await waitFor(() => expect(second.result.current.loaded).toBe(true))

    expect(second.result.current.todayResult?.solved).toBe(true)
    expect(second.result.current.todayResult?.attempts).toEqual([miss, winner])
    // Unchanged by the anchor-shift rule (Epic 3): today is solved, so the
    // anchor stays on today; nothing precedes it, so the run is just today.
    expect(second.result.current.streak).toBe(1)
  })
})
