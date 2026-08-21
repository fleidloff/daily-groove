'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { DailyResult } from '../types'
import { createLocalStore, type ResultStore } from '../lib/storage'
import { computeStreak } from '../lib/streak'

/**
 * Module-singleton store so every consumer that doesn't inject one shares the
 * same localStorage-backed adapter. Created once at import; tests inject a mock.
 */
const defaultStore: ResultStore = createLocalStore()

/**
 * Sort results most-recent first by ISO date. ISO `YYYY-MM-DD` strings sort
 * lexicographically, so a plain string compare is a date compare.
 */
function sortMostRecentFirst(results: DailyResult[]): DailyResult[] {
  return [...results].sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  )
}

export type UseProgress = {
  todayResult: DailyResult | null
  streak: number
  history: DailyResult[]
  save: (r: DailyResult) => Promise<void>
  loaded: boolean
}

/**
 * Loads the player's saved progress through a `ResultStore` and derives the
 * streak and history from it. On mount it reads all results plus today's result;
 * `save` writes through the store then updates local state so no full reload is
 * needed. Streak and history are derived (never persisted separately), so they
 * always reflect the current result set.
 */
export function useProgress(
  today: string,
  store: ResultStore = defaultStore,
): UseProgress {
  const [all, setAll] = useState<DailyResult[]>([])
  const [todayResult, setTodayResult] = useState<DailyResult | null>(null)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    let active = true
    // Async load from the Promise-based ResultStore: state is set after the I/O
    // resolves (and guarded against unmount). This is not the synchronous
    // derive-and-set in render that the rule targets.
    /* eslint-disable react-hooks/set-state-in-effect -- async data load, unmount-guarded */
    setLoaded(false)
    Promise.all([store.getAll(), store.get(today)]).then(
      ([allResults, todays]) => {
        if (!active) return
        setAll(allResults)
        setTodayResult(todays)
        setLoaded(true)
      },
    )
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      active = false
    }
  }, [store, today])

  const save = useCallback(
    async (r: DailyResult) => {
      await store.save(r)
      setAll((prev) => [...prev.filter((x) => x.date !== r.date), r])
      if (r.date === today) setTodayResult(r)
    },
    [store, today],
  )

  const streak = useMemo(() => computeStreak(all, today), [all, today])
  const history = useMemo(() => sortMostRecentFirst(all), [all])

  return { todayResult, streak, history, save, loaded }
}
