'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Answer, Attempt, DailyResult } from '../types'
import { createLocalStore, type ResultStore } from '../lib/persistence/storage'
import { computeStreak } from '../lib/persistence/streak'

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

/**
 * The day as the puzzle currently knows it. The attempt list comes from the
 * game store, which is the one place that accumulates it — passing the whole
 * list rather than the newest attempt keeps this hook from holding a second,
 * drifting copy of the same sequence.
 */
export type DayProgress = {
  answer: Answer
  attempts: Attempt[]
  solved: boolean
  /**
   * The id of the groove the day was played against. Required here, optional on
   * the stored record: every day written from now on knows its groove, and only
   * records saved before feature-4 lack one. Without it the day would have to be
   * re-resolved by date, which re-points at a different groove the moment the
   * catalogue grows (R7).
   */
  grooveId: string
}

export type UseProgress = {
  todayResult: DailyResult | null
  streak: number
  history: DailyResult[]
  /**
   * Write the day's record. Called after every check, not only on a solve, so
   * a reload mid-game comes back to the attempts already spent (R2).
   */
  recordAttempt: (day: DayProgress) => Promise<void>
  loaded: boolean
}

/**
 * Loads the player's saved progress through a `ResultStore` and derives the
 * streak and history from it. On mount it reads all results plus today's result;
 * `recordAttempt` writes through the store then updates local state so no full
 * reload is needed. Streak and history are derived (never persisted separately),
 * so they always reflect the current result set.
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

  const recordAttempt = useCallback(
    async ({ answer, attempts, solved, grooveId }: DayProgress) => {
      const record: DailyResult = {
        date: today,
        answer,
        attempts,
        solved,
        grooveId,
      }
      // Session state first, persistence second: a store that throws — quota,
      // disabled storage — must never cost the player the guess they just made
      // (R6, AC5). `createLocalStore` already swallows its own write failures;
      // this guards an injected store that does not.
      setAll((prev) => [...prev.filter((x) => x.date !== record.date), record])
      setTodayResult(record)
      try {
        await store.save(record)
      } catch {
        // Deliberately ignored — see above.
      }
    },
    [store, today],
  )

  const streak = useMemo(() => computeStreak(all, today), [all, today])
  const history = useMemo(() => sortMostRecentFirst(all), [all])

  return { todayResult, streak, history, recordAttempt, loaded }
}
