'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  createLocalPreferenceStore,
  type PreferenceStore,
} from '../lib/persistence/preferences'

const defaultStore: PreferenceStore = createLocalPreferenceStore()

export type UseSimpleMode = {
  simple: boolean
  setSimple: (simple: boolean) => void
  loaded: boolean
}

export function useSimpleMode(
  store: PreferenceStore = defaultStore,
): UseSimpleMode {
  const [simple, setSimpleState] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
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
      setSimpleState(next)
      void Promise.resolve(store.update({ simpleMode: next })).catch(() => {
        // An injected store that throws must not break the toggle.
      })
    },
    [store],
  )

  return { simple, setSimple, loaded }
}
