'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  createLocalPreferenceStore,
  type PreferenceStore,
} from '../lib/persistence/preferences'

const defaultStore: PreferenceStore = createLocalPreferenceStore()

export type UseTapSounds = {
  tapSounds: boolean
  setTapSounds: (on: boolean) => void
  loaded: boolean
}

export function useTapSounds(
  store: PreferenceStore = defaultStore,
): UseTapSounds {
  const [tapSounds, setTapSoundsState] = useState(true)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
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
      setTapSoundsState(on)
      void Promise.resolve(store.update({ tapSounds: on })).catch(() => {
        // An injected store that throws must not break the toggle.
      })
    },
    [store],
  )

  return { tapSounds, setTapSounds, loaded }
}
