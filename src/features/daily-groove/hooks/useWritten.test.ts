import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { PreferenceStore, Preferences } from '../lib/persistence/preferences'
import { useWritten } from './useWritten'

function makeStore(initial: Preferences = { tapSounds: true }) {
  let saved: Preferences = initial
  const store: PreferenceStore = {
    get: vi.fn(async () => saved),
    update: vi.fn(async (patch: Partial<Preferences>) => {
      saved = { ...saved, ...patch }
    }),
  }
  return { store, saved: () => saved }
}

describe('useWritten', () => {
  it('starts on concert and reports loaded once the store has answered (F23 E1 R2, AC3)', async () => {
    const { store } = makeStore()
    const { result } = renderHook(() => useWritten(store))

    expect(result.current.written).toBe('C')
    expect(result.current.loaded).toBe(false)
    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.written).toBe('C')
  })

  it('adopts a stored instrument (F23 E1 R2, AC2)', async () => {
    const { store } = makeStore({ tapSounds: true, written: 'E♭' })
    const { result } = renderHook(() => useWritten(store))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.written).toBe('E♭')
  })

  it('setWritten updates the value and writes a patch naming only written (F23 E1 R2, R10, AC12)', async () => {
    const { store, saved } = makeStore({ simpleMode: true, tapSounds: false })
    const { result } = renderHook(() => useWritten(store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => {
      result.current.setWritten('B♭')
    })

    expect(result.current.written).toBe('B♭')
    expect(store.update).toHaveBeenCalledWith({ written: 'B♭' })
    expect(saved()).toEqual({ simpleMode: true, tapSounds: false, written: 'B♭' })
  })

  it('a store that rejects on write does not cost the player the switch (F23 E1 R3, AC4)', async () => {
    const store: PreferenceStore = {
      get: vi.fn(async () => ({ tapSounds: true })),
      update: vi.fn(async () => {
        throw new Error('QuotaExceededError')
      }),
    }
    const { result } = renderHook(() => useWritten(store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => {
      result.current.setWritten('B♭')
    })

    expect(result.current.written).toBe('B♭')
  })

  it('a store that rejects on read leaves the player on concert and still reports loaded (F23 E1 R3, AC4)', async () => {
    const store: PreferenceStore = {
      get: vi.fn(async () => {
        throw new Error('SecurityError')
      }),
      update: vi.fn(async () => {}),
    }
    const { result } = renderHook(() => useWritten(store))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.written).toBe('C')
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
    const { result, unmount } = renderHook(() => useWritten(store))
    unmount()

    await act(async () => {
      release({ tapSounds: true, written: 'E♭' })
    })

    expect(result.current.loaded).toBe(false)
  })
})
