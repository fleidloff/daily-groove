import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { DailyResult } from '../types'
import type { PreferenceStore, Preferences } from '../lib/persistence/preferences'
import type { ResultStore } from '../lib/persistence/storage'
import { useSimpleMode } from './useSimpleMode'

function makeStore(
  initial: Preferences = { simpleMode: false, tapSounds: true },
) {
  let saved: Preferences = initial
  const store: PreferenceStore = {
    get: vi.fn(async () => saved),
    update: vi.fn(async (patch: Partial<Preferences>) => {
      saved = { ...saved, ...patch }
    }),
  }
  return { store, saved: () => saved }
}

function day(index: number, date = `2026-07-${String((index % 28) + 1).padStart(2, '0')}`): DailyResult {
  return {
    date,
    answer: { root: 'C', flavour: 'Minor' },
    attempts: [
      {
        root: 'C',
        flavour: 'Minor',
        correct: true,
        rootMatched: true,
        flavourMatched: true,
      },
    ],
    solved: true,
  }
}

const SOME_DAY: DailyResult = day(0, '2026-08-20')
const LAPSED_DAY: DailyResult = day(0, '2026-01-01')

function makeResults(results: DailyResult[] = []): ResultStore {
  return {
    get: vi.fn(async () => null),
    getAll: vi.fn(async () => results),
    save: vi.fn(async () => {}),
  }
}

describe('useSimpleMode', () => {
  it('starts off and reports loaded once the store has answered (E5 A3, AC7)', async () => {
    const { store } = makeStore()
    const { result } = renderHook(() => useSimpleMode({ prefs: store }))

    expect(result.current.simple).toBe(false)
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.simple).toBe(false)
  })

  it('setSimple(true) updates the returned value and writes through (E5 R7, R8a, AC7)', async () => {
    const { store, saved } = makeStore()
    const { result } = renderHook(() => useSimpleMode({ prefs: store }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => {
      result.current.setSimple(true)
    })

    expect(result.current.simple).toBe(true)
    expect(store.update).toHaveBeenCalledWith({ simpleMode: true })
    expect(saved()).toEqual({ simpleMode: true, tapSounds: true })
  })

  it('writes a patch, so the preference beside it is left alone (F16 E2 R7)', async () => {
    const { store, saved } = makeStore({ simpleMode: false, tapSounds: false })
    const { result } = renderHook(() => useSimpleMode({ prefs: store }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => {
      result.current.setSimple(true)
    })

    expect(saved().tapSounds).toBe(false)
    expect(saved()).toEqual({ simpleMode: true, tapSounds: false })
  })

  it('adopts a preference the store already holds (E5 R7, AC7)', async () => {
    const { store } = makeStore({ simpleMode: true, tapSounds: true })
    const { result } = renderHook(() => useSimpleMode({ prefs: store }))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.simple).toBe(true)
  })

  it('switches back off and writes that through too (E5 R8a)', async () => {
    const { store, saved } = makeStore({ simpleMode: true, tapSounds: true })
    const { result } = renderHook(() => useSimpleMode({ prefs: store }))
    await waitFor(() => expect(result.current.simple).toBe(true))

    await act(async () => {
      result.current.setSimple(false)
    })

    expect(result.current.simple).toBe(false)
    expect(store.update).toHaveBeenCalledWith({ simpleMode: false })
    expect(saved()).toEqual({ simpleMode: false, tapSounds: true })
  })

  it('a store that rejects on write does not cost the player the switch (E5 R8a)', async () => {
    const store: PreferenceStore = {
      get: vi.fn(async () => ({ simpleMode: false, tapSounds: true })),
      update: vi.fn(async () => {
        throw new Error('QuotaExceededError')
      }),
    }
    const { result } = renderHook(() => useSimpleMode({ prefs: store }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => {
      result.current.setSimple(true)
    })

    expect(result.current.simple).toBe(true)
  })

  it('a load that resolves after unmount sets no state', async () => {
    let release: (prefs: Preferences) => void = () => {}
    const store: PreferenceStore = {
      get: vi.fn(
        () =>
          new Promise<Preferences>((resolve) => {
            release = resolve
          }),
      ),
      update: vi.fn(async () => {}),
    }
    const results = makeResults()
    const { result, unmount } = renderHook(() =>
      useSimpleMode({ prefs: store, results }),
    )
    unmount()

    await act(async () => {
      release({ simpleMode: true, tapSounds: true })
    })

    expect(result.current.loaded).toBe(false)
  })

  it('starts Simple, and writes that down, when nothing is stored and nothing is saved (F22 E1 R1, R2, AC1, AC2)', async () => {
    const { store, saved } = makeStore({ tapSounds: true })
    const results = makeResults([])
    const { result } = renderHook(() => useSimpleMode({ prefs: store, results }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.simple).toBe(true)
    expect(store.update).toHaveBeenCalledTimes(1)
    expect(store.update).toHaveBeenCalledWith({ simpleMode: true })
    expect(saved()).toEqual({ simpleMode: true, tapSounds: true })
  })

  it('keeps the full set, and writes that down, for a player with results and nothing stored (F22 E1 R3, AC3)', async () => {
    const { store, saved } = makeStore({ tapSounds: true })
    const results = makeResults([SOME_DAY])
    const { result } = renderHook(() => useSimpleMode({ prefs: store, results }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.simple).toBe(false)
    expect(store.update).toHaveBeenCalledTimes(1)
    expect(store.update).toHaveBeenCalledWith({ simpleMode: false })
    expect(saved()).toEqual({ simpleMode: false, tapSounds: true })
  })

  it('a stored false stays the full set with no results (F22 E1 R4, AC4)', async () => {
    const { store } = makeStore({ simpleMode: false, tapSounds: true })
    const results = makeResults([])
    const { result } = renderHook(() => useSimpleMode({ prefs: store, results }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.simple).toBe(false)
    expect(store.update).not.toHaveBeenCalled()
  })

  it('a stored true stays Simple with forty results (F22 E1 R4, AC4)', async () => {
    const { store } = makeStore({ simpleMode: true, tapSounds: true })
    const results = makeResults(Array.from({ length: 40 }, (_, i) => day(i)))
    const { result } = renderHook(() => useSimpleMode({ prefs: store, results }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.simple).toBe(true)
    expect(store.update).not.toHaveBeenCalled()
  })

  it('gives the full set to a lapsed player with nothing stored — a lapse is not a first visit (F22 E1 R4)', async () => {
    const { store } = makeStore({ tapSounds: true })
    const results = makeResults([LAPSED_DAY])
    const { result } = renderHook(() => useSimpleMode({ prefs: store, results }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.simple).toBe(false)
    expect(store.update).toHaveBeenCalledWith({ simpleMode: false })
  })

  it('is not loaded while the results are still pending, even with a stored preference (F22 E1 R6, AC6)', async () => {
    let release: (results: DailyResult[]) => void = () => {}
    const { store } = makeStore({ simpleMode: true, tapSounds: true })
    const results: ResultStore = {
      get: vi.fn(async () => null),
      getAll: vi.fn(
        () =>
          new Promise<DailyResult[]>((resolve) => {
            release = resolve
          }),
      ),
      save: vi.fn(async () => {}),
    }
    const { result } = renderHook(() => useSimpleMode({ prefs: store, results }))

    await act(async () => {})
    expect(result.current.loaded).toBe(false)

    await act(async () => {
      release([])
    })
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.simple).toBe(true)
  })

  it('is not loaded while the preferences are still pending, even with results known (F22 E1 R6)', async () => {
    let release: (prefs: Preferences) => void = () => {}
    const store: PreferenceStore = {
      get: vi.fn(
        () =>
          new Promise<Preferences>((resolve) => {
            release = resolve
          }),
      ),
      update: vi.fn(async () => {}),
    }
    const results = makeResults([SOME_DAY])
    const { result } = renderHook(() => useSimpleMode({ prefs: store, results }))

    await act(async () => {})
    expect(result.current.loaded).toBe(false)

    await act(async () => {
      release({ simpleMode: true, tapSounds: true })
    })
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.simple).toBe(true)
  })

  it('a preference read that rejects still lands on Simple for no results, without writing (F22 E1 R8, AC8)', async () => {
    const store: PreferenceStore = {
      get: vi.fn(async () => {
        throw new Error('SecurityError')
      }),
      update: vi.fn(async () => {}),
    }
    const results = makeResults([])
    const { result } = renderHook(() => useSimpleMode({ prefs: store, results }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.simple).toBe(true)
    expect(store.update).not.toHaveBeenCalled()
  })

  it('a results read that rejects still decides for the session, without writing (F22 E1 R8)', async () => {
    const { store } = makeStore({ tapSounds: true })
    const results: ResultStore = {
      get: vi.fn(async () => null),
      getAll: vi.fn(async () => {
        throw new Error('SecurityError')
      }),
      save: vi.fn(async () => {}),
    }
    const { result } = renderHook(() => useSimpleMode({ prefs: store, results }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.simple).toBe(true)
    expect(store.update).not.toHaveBeenCalled()
  })

  it('a first-visit write that rejects costs nothing (F22 E1 R8)', async () => {
    const store: PreferenceStore = {
      get: vi.fn(async () => ({ tapSounds: true })),
      update: vi.fn(async () => {
        throw new Error('QuotaExceededError')
      }),
    }
    const results = makeResults([])
    const { result } = renderHook(() => useSimpleMode({ prefs: store, results }))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.simple).toBe(true)
    expect(store.update).toHaveBeenCalledWith({ simpleMode: true })
  })

  it('a flip after a first-visit default is written once more, as a patch (F22 E1 R5, AC5)', async () => {
    const { store, saved } = makeStore({ tapSounds: false })
    const results = makeResults([])
    const { result } = renderHook(() => useSimpleMode({ prefs: store, results }))
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(saved()).toEqual({ tapSounds: false, simpleMode: true })

    await act(async () => {
      result.current.setSimple(false)
    })

    expect(store.update).toHaveBeenCalledTimes(2)
    expect(store.update).toHaveBeenLastCalledWith({ simpleMode: false })
    expect(saved()).toEqual({ tapSounds: false, simpleMode: false })
  })
})
