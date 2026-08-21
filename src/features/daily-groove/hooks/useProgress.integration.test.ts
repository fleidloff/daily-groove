import { describe, it, expect } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { DailyResult } from '../types'
import { createLocalStore } from '../lib/storage'
import { isoDate } from '../lib/selectGroove'
import { useProgress } from './useProgress'

// Integration: exercise useProgress against the REAL createLocalStore over the
// shimmed jsdom localStorage (cleared before each test by vitest.setup.ts). A
// result saved in one "session" must survive a reload — a brand-new store
// instance over the same storage (R7, AC1).
describe('useProgress + createLocalStore (real storage)', () => {
  it('a saved result survives a remount with a fresh store (R7, AC1)', async () => {
    const today = isoDate(new Date())
    const result: DailyResult = {
      date: today,
      guesses: { scale: 'C minor', chord: 'Cm7' },
      correctness: { scale: true, chord: false },
    }

    // First session: save through the hook.
    const firstStore = createLocalStore()
    const first = renderHook(() => useProgress(today, firstStore))
    await waitFor(() => expect(first.result.current.loaded).toBe(true))
    await act(async () => {
      await first.result.current.save(result)
    })
    first.unmount()

    // Second session: a brand-new store over the same localStorage ("reload").
    const secondStore = createLocalStore()
    const second = renderHook(() => useProgress(today, secondStore))
    await waitFor(() => expect(second.result.current.loaded).toBe(true))

    expect(second.result.current.todayResult).toEqual(result)
    expect(second.result.current.streak).toBe(1)
    expect(second.result.current.history).toEqual([result])
  })
})
