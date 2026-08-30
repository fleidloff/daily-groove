import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { PreferenceStore, Preferences } from '../lib/persistence/preferences'
import { useSimpleMode } from './useSimpleMode'

/** An in-memory `PreferenceStore` whose saved value the test can read back. */
function makeStore(initial: Preferences = { simpleMode: false }) {
  let saved: Preferences = initial
  const store: PreferenceStore = {
    get: vi.fn(async () => saved),
    set: vi.fn(async (prefs: Preferences) => {
      saved = prefs
    }),
  }
  return { store, saved: () => saved }
}

describe('useSimpleMode', () => {
  it('starts off and reports loaded once the store has answered (E5 A3, AC7)', async () => {
    const { store } = makeStore()
    const { result } = renderHook(() => useSimpleMode(store))

    expect(result.current.simple).toBe(false)
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.simple).toBe(false)
  })

  it('setSimple(true) updates the returned value and writes through (E5 R7, R8a, AC7)', async () => {
    const { store, saved } = makeStore()
    const { result } = renderHook(() => useSimpleMode(store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => {
      result.current.setSimple(true)
    })

    expect(result.current.simple).toBe(true)
    expect(store.set).toHaveBeenCalledWith({ simpleMode: true })
    expect(saved()).toEqual({ simpleMode: true })
  })

  it('adopts a preference the store already holds (E5 R7, AC7)', async () => {
    const { store } = makeStore({ simpleMode: true })
    const { result } = renderHook(() => useSimpleMode(store))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.simple).toBe(true)
  })

  it('switches back off and writes that through too (E5 R8a)', async () => {
    const { store, saved } = makeStore({ simpleMode: true })
    const { result } = renderHook(() => useSimpleMode(store))
    await waitFor(() => expect(result.current.simple).toBe(true))

    await act(async () => {
      result.current.setSimple(false)
    })

    expect(result.current.simple).toBe(false)
    expect(saved()).toEqual({ simpleMode: false })
  })

  it('a store that rejects on write does not cost the player the switch (E5 R8a)', async () => {
    const store: PreferenceStore = {
      get: vi.fn(async () => ({ simpleMode: false })),
      set: vi.fn(async () => {
        throw new Error('QuotaExceededError')
      }),
    }
    const { result } = renderHook(() => useSimpleMode(store))
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
      set: vi.fn(async () => {}),
    }
    const { result, unmount } = renderHook(() => useSimpleMode(store))
    unmount()

    await act(async () => {
      release({ simpleMode: true })
    })

    expect(result.current.loaded).toBe(false)
  })
})
