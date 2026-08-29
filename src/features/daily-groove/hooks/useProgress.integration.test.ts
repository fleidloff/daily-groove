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
    }
    expect(second.result.current.todayResult).toEqual(expected)
    // Unsolved, so it does not build the streak.
    expect(second.result.current.streak).toBe(0)
    expect(second.result.current.history).toEqual([expected])
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
        attempts: [miss],
        solved: false,
      })
    })
    await act(async () => {
      await first.result.current.recordAttempt({
        answer: ANSWER,
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
    expect(second.result.current.streak).toBe(1)
  })
})
