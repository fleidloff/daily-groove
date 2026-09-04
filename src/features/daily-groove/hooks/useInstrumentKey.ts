'use client'

import { useCallback, useEffect, useState } from 'react'
import type { InstrumentKey } from '@/lib/theory/transpose'
import {
  createLocalPreferenceStore,
  type PreferenceStore,
} from '../lib/persistence/preferences'

const defaultStore: PreferenceStore = createLocalPreferenceStore()

export type UseInstrumentKey = {
  instrumentKey: InstrumentKey
  setInstrumentKey: (instrumentKey: InstrumentKey) => void
  loaded: boolean
}

export function useInstrumentKey(store: PreferenceStore = defaultStore): UseInstrumentKey {
  const [instrumentKey, setInstrumentKeyState] = useState<InstrumentKey>('C')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    /* eslint-disable react-hooks/set-state-in-effect -- async data load, unmount-guarded */
    setLoaded(false)
    store.get().then(
      (prefs) => {
        if (!active) return
        setInstrumentKeyState(prefs.instrumentKey ?? 'C')
        setLoaded(true)
      },
      () => {
        if (!active) return
        setLoaded(true)
      },
    )
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      active = false
    }
  }, [store])

  const setInstrumentKey = useCallback(
    (next: InstrumentKey) => {
      setInstrumentKeyState(next)
      void Promise.resolve(store.update({ instrumentKey: next })).catch(() => {
        // An injected store that throws must not break the pill.
      })
    },
    [store],
  )

  return { instrumentKey, setInstrumentKey, loaded }
}
