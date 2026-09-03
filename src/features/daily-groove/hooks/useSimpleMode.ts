'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  createLocalPreferenceStore,
  type PreferenceStore,
} from '../lib/persistence/preferences'
import { createLocalStore, type ResultStore } from '../lib/persistence/storage'

const defaultPrefs: PreferenceStore = createLocalPreferenceStore()
const defaultResults: ResultStore = createLocalStore()

export type UseSimpleMode = {
  simple: boolean
  setSimple: (simple: boolean) => void
  loaded: boolean
}

export type UseSimpleModeDeps = {
  prefs?: PreferenceStore
  results?: ResultStore
}

type Decision = { simple: boolean; write: boolean }

function decide(
  prefs: PromiseSettledResult<{ simpleMode?: boolean }>,
  results: PromiseSettledResult<unknown[]>,
): Decision {
  const stored = prefs.status === 'fulfilled' ? prefs.value.simpleMode : undefined
  if (typeof stored === 'boolean') return { simple: stored, write: false }

  const hasResults = results.status === 'fulfilled' && results.value.length > 0
  const bothRead = prefs.status === 'fulfilled' && results.status === 'fulfilled'
  return { simple: !hasResults, write: bothRead }
}

export function useSimpleMode(deps: UseSimpleModeDeps = {}): UseSimpleMode {
  const prefs = deps.prefs ?? defaultPrefs
  const results = deps.results ?? defaultResults
  const [simple, setSimpleState] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    /* eslint-disable react-hooks/set-state-in-effect -- async data load, unmount-guarded */
    setLoaded(false)
    Promise.allSettled([prefs.get(), results.getAll()]).then(
      ([prefsRead, resultsRead]) => {
        if (!active) return
        const decision = decide(prefsRead, resultsRead)
        setSimpleState(decision.simple)
        setLoaded(true)
        if (decision.write) {
          void Promise.resolve(
            prefs.update({ simpleMode: decision.simple }),
          ).catch(() => {})
        }
      },
    )
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      active = false
    }
  }, [prefs, results])

  const setSimple = useCallback(
    (next: boolean) => {
      setSimpleState(next)
      void Promise.resolve(prefs.update({ simpleMode: next })).catch(() => {
        // An injected store that throws must not break the toggle.
      })
    },
    [prefs],
  )

  return { simple, setSimple, loaded }
}
