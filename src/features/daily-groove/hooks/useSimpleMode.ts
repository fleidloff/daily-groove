'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  createLocalPreferenceStore,
  type PreferenceStore,
} from '../lib/persistence/preferences'

/**
 * Module-singleton store so every consumer that doesn't inject one shares the
 * same localStorage-backed adapter. Created once at import; tests inject a mock.
 */
const defaultStore: PreferenceStore = createLocalPreferenceStore()

export type UseSimpleMode = {
  /** Whether simple mode is on. `false` until the stored value has loaded. */
  simple: boolean
  /**
   * Turn simple mode on or off. Not an attempt and never locked by having
   * guessed — the toggle stays operable for the whole day (E5 R8a).
   */
  setSimple: (simple: boolean) => void
  /** The stored preference has been read. */
  loaded: boolean
}

/**
 * Reads and writes the simple-mode preference through a `PreferenceStore`, so
 * the toggle's position survives a reload and a new day (E5 R7). The value is
 * held in local state and updated optimistically on `setSimple`, with the write
 * behind it: a store that fails — quota, disabled storage — must never cost the
 * player the switch they just flipped.
 */
export function useSimpleMode(
  store: PreferenceStore = defaultStore,
): UseSimpleMode {
  const [simple, setSimpleState] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    // Async load from the Promise-based PreferenceStore: state is set after the
    // I/O resolves (and guarded against unmount). This is not the synchronous
    // derive-and-set in render that the rule targets.
    /* eslint-disable react-hooks/set-state-in-effect -- async data load, unmount-guarded */
    setLoaded(false)
    store.get().then((prefs) => {
      if (!active) return
      setSimpleState(prefs.simpleMode)
      setLoaded(true)
    })
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      active = false
    }
  }, [store])

  const setSimple = useCallback(
    (next: boolean) => {
      // Session state first, persistence second — see above.
      setSimpleState(next)
      void Promise.resolve(store.update({ simpleMode: next })).catch(() => {
        // Deliberately ignored. `createLocalPreferenceStore` already swallows
        // its own write failures; this guards an injected store that does not.
      })
    },
    [store],
  )

  return { simple, setSimple, loaded }
}
