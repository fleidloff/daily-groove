import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { PreferenceStore, Preferences } from '../lib/persistence/preferences'
import { useTapSounds } from './useTapSounds'

/** An in-memory `PreferenceStore` whose saved value the test can read back. */
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

describe('useTapSounds', () => {
  it('starts on and reports loaded once the store has answered (F16 E2 R2, AC2)', async () => {
    const { store } = makeStore()
    const { result } = renderHook(() => useTapSounds(store))

    expect(result.current.tapSounds).toBe(true)
    expect(result.current.loaded).toBe(false)
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.tapSounds).toBe(true)
  })

  it('adopts a preference the store already holds (F16 E2 R3)', async () => {
    const { store } = makeStore({ simpleMode: false, tapSounds: false })
    const { result } = renderHook(() => useTapSounds(store))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.tapSounds).toBe(false)
  })

  it('setTapSounds(false) updates the returned value and writes a patch through (F16 E2 R1, R3, R4)', async () => {
    const { store, saved } = makeStore()
    const { result } = renderHook(() => useTapSounds(store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => {
      result.current.setTapSounds(false)
    })

    expect(result.current.tapSounds).toBe(false)
    expect(store.update).toHaveBeenCalledWith({ tapSounds: false })
    expect(saved()).toEqual({ simpleMode: false, tapSounds: false })
  })

  it('switches back on and writes that through too (F16 E2 R4)', async () => {
    const { store, saved } = makeStore({ simpleMode: false, tapSounds: false })
    const { result } = renderHook(() => useTapSounds(store))
    await waitFor(() => expect(result.current.tapSounds).toBe(false))

    await act(async () => {
      result.current.setTapSounds(true)
    })

    expect(result.current.tapSounds).toBe(true)
    expect(store.update).toHaveBeenCalledWith({ tapSounds: true })
    expect(saved()).toEqual({ simpleMode: false, tapSounds: true })
  })

  it('leaves the simple-mode preference exactly where it was (F16 E2 R7)', async () => {
    const { store, saved } = makeStore({ simpleMode: true, tapSounds: true })
    const { result } = renderHook(() => useTapSounds(store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => {
      result.current.setTapSounds(false)
    })

    expect(saved().simpleMode).toBe(true)
    expect(saved()).toEqual({ simpleMode: true, tapSounds: false })
  })

  it('a store that rejects on write does not cost the player the switch (F16 E2 R8, AC8)', async () => {
    const store: PreferenceStore = {
      get: vi.fn(async () => ({ simpleMode: false, tapSounds: true })),
      update: vi.fn(async () => {
        throw new Error('QuotaExceededError')
      }),
    }
    const { result } = renderHook(() => useTapSounds(store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => {
      result.current.setTapSounds(false)
    })

    expect(result.current.tapSounds).toBe(false)
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
    const { result, unmount } = renderHook(() => useTapSounds(store))
    unmount()

    await act(async () => {
      release({ simpleMode: false, tapSounds: false })
    })

    expect(result.current.loaded).toBe(false)
  })
})
