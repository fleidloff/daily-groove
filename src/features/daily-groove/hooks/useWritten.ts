'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Written } from '@/lib/theory/transpose'
import {
  createLocalPreferenceStore,
  type PreferenceStore,
} from '../lib/persistence/preferences'

const defaultStore: PreferenceStore = createLocalPreferenceStore()

export type UseWritten = {
  written: Written
  setWritten: (written: Written) => void
  loaded: boolean
}

export function useWritten(store: PreferenceStore = defaultStore): UseWritten {
  const [written, setWrittenState] = useState<Written>('C')
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    /* eslint-disable react-hooks/set-state-in-effect -- async data load, unmount-guarded */
    setLoaded(false)
    store.get().then(
      (prefs) => {
        if (!active) return
        setWrittenState(prefs.written ?? 'C')
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

  const setWritten = useCallback(
    (next: Written) => {
      setWrittenState(next)
      void Promise.resolve(store.update({ written: next })).catch(() => {
        // An injected store that throws must not break the pill.
      })
    },
    [store],
  )

  return { written, setWritten, loaded }
}
