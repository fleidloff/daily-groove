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

export type UseTapSounds = {
  /** Whether a chip tap sounds. `true` until the stored value has loaded. */
  tapSounds: boolean
  /**
   * Turn the tap sounds on or off. Never locked by the day being over: this is
   * a durable setting rather than a record of how the day was played, and the
   * guess card is the only place it can be changed (F16 E2 R5a).
   */
  setTapSounds: (on: boolean) => void
  /** The stored preference has been read. */
  loaded: boolean
}

/**
 * Reads and writes the tap-sounds preference through a `PreferenceStore`, so the
 * switch's position survives a reload and a new day (F16 E2 R3). Shaped exactly
 * like `useSimpleMode`: the value is held in local state and updated
 * optimistically, with the write behind it, so a store that fails — quota,
 * disabled storage, a private window — never costs the player the switch they
 * just flipped (R8).
 *
 * The pre-load value is `true`, which is the default rather than a guess: the
 * sounds are on unless the player turned them off (R2), so nobody sees the
 * switch in a position the store is about to contradict.
 */
export function useTapSounds(
  store: PreferenceStore = defaultStore,
): UseTapSounds {
  const [tapSounds, setTapSoundsState] = useState(true)
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
      setTapSoundsState(prefs.tapSounds)
      setLoaded(true)
    })
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      active = false
    }
  }, [store])

  const setTapSounds = useCallback(
    (on: boolean) => {
      // Session state first, persistence second — see above.
      setTapSoundsState(on)
      // A patch, never a whole object: the merge is what keeps this writer from
      // erasing the simple-mode preference it has never heard of (R7).
      void Promise.resolve(store.update({ tapSounds: on })).catch(() => {
        // Deliberately ignored. `createLocalPreferenceStore` already swallows
        // its own write failures; this guards an injected store that does not.
      })
    },
    [store],
  )

  return { tapSounds, setTapSounds, loaded }
}
