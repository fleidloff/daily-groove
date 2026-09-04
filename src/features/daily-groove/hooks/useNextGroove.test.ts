import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useNextGroove } from './useNextGroove'

const MINUTE = 60 * 1000

describe('useNextGroove', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('counts the hours and minutes to the midnight that ends the day', () => {
    const today = new Date(2026, 8, 4, 16, 48, 30)
    vi.setSystemTime(today)

    const { result } = renderHook(() => useNextGroove(today))

    expect(result.current).toEqual({ ready: false, hours: 7, minutes: 11 })
  })

  it('ticks down on the minute', () => {
    const today = new Date(2026, 8, 4, 16, 48, 30)
    vi.setSystemTime(today)
    const { result } = renderHook(() => useNextGroove(today))

    act(() => {
      vi.advanceTimersByTime(29 * 1000)
    })
    expect(result.current).toEqual({ ready: false, hours: 7, minutes: 11 })

    act(() => {
      vi.advanceTimersByTime(1000)
    })
    expect(result.current).toEqual({ ready: false, hours: 7, minutes: 11 })

    act(() => {
      vi.advanceTimersByTime(MINUTE)
    })
    expect(result.current).toEqual({ ready: false, hours: 7, minutes: 10 })

    act(() => {
      vi.advanceTimersByTime(MINUTE)
    })
    expect(result.current).toEqual({ ready: false, hours: 7, minutes: 9 })
  })

  it('reports the next groove as ready once midnight has passed', () => {
    const today = new Date(2026, 8, 4, 23, 58, 30)
    vi.setSystemTime(today)
    const { result } = renderHook(() => useNextGroove(today))

    expect(result.current).toEqual({ ready: false, hours: 0, minutes: 1 })

    act(() => {
      vi.advanceTimersByTime(2 * MINUTE)
    })
    expect(result.current).toEqual({ ready: true })

    act(() => {
      vi.advanceTimersByTime(60 * MINUTE)
    })
    expect(result.current).toEqual({ ready: true })
  })

  it('is ready at once for a day that has already ended', () => {
    const yesterday = new Date(2026, 8, 3, 12, 0, 0)
    vi.setSystemTime(new Date(2026, 8, 4, 9, 0, 0))

    const { result } = renderHook(() => useNextGroove(yesterday))

    expect(result.current).toEqual({ ready: true })
  })

  it('stops its timer on unmount', () => {
    const today = new Date(2026, 8, 4, 16, 48, 30)
    vi.setSystemTime(today)
    const { unmount } = renderHook(() => useNextGroove(today))

    unmount()

    expect(vi.getTimerCount()).toBe(0)
  })
})
