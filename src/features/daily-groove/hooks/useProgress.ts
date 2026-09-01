'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Answer, Attempt, DailyResult } from '../types'
import { createLocalStore, type ResultStore } from '../lib/persistence/storage'
import { isNewOrLapsed } from '../lib/persistence/lapsed'
import { computeStreak } from '../lib/persistence/streak'

/**
 * Module-singleton store so every consumer that doesn't inject one shares the
 * same localStorage-backed adapter. Created once at import; tests inject a mock.
 */
const defaultStore: ResultStore = createLocalStore()

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
  /**
   * The day was given up on. Omitted on a day that was not — the flag is
   * absent rather than `false` on the record, so a day written before
   * feature-7 and an unrevealed one written after it read the same (E3 R13).
   */
  revealed?: boolean
}

export type UseProgress = {
  todayResult: DailyResult | null
  streak: number
  /**
   * Write the day's record. Called after every check, not only on a solve, so
   * a reload mid-game comes back to the attempts already spent (R2).
   */
  recordAttempt: (day: DayProgress) => Promise<void>
  loaded: boolean
  /**
   * The player arrived with nothing saved, or with nothing saved in the last
   * `LAPSE_DAYS` days — so the game explains itself again (F8 E3 R1, R2, R3).
   *
   * Latched: written once, in the load that read the records, and never
   * recomputed. It describes how the player *arrived*, not what they have done
   * since, so today's first attempt — which writes a record dated today — must
   * not flip it while the explanation is being read (F8 E3 R16).
   */
  newOrLapsed: boolean
}

/**
 * Loads the player's saved progress through a `ResultStore` and derives the
 * streak from it. On mount it reads all results plus today's result;
 * `recordAttempt` writes through the store then updates local state so no full
 * reload is needed. The full record list stays in state because `computeStreak`
 * needs every record and `recordAttempt` updates it optimistically — but it is
 * not handed out: the streak is derived (never persisted separately), so it
 * always reflects the current result set.
 */
export function useProgress(
  today: string,
  store: ResultStore = defaultStore,
): UseProgress {
  const [all, setAll] = useState<DailyResult[]>([])
  const [todayResult, setTodayResult] = useState<DailyResult | null>(null)
  const [loaded, setLoaded] = useState(false)
  // Deliberately state, not a `useMemo` over `all`: `all` changes on every
  // write, and a derivation would take the how-to-play box away the moment the
  // player made their first guess (F8 E3 R16, AC15, AC16).
  const [newOrLapsed, setNewOrLapsed] = useState(false)

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
        // Decided here and nowhere else. `recordAttempt` never touches it.
        setNewOrLapsed(isNewOrLapsed(allResults, today))
        setLoaded(true)
      },
    )
    /* eslint-enable react-hooks/set-state-in-effect */
    return () => {
      active = false
    }
  }, [store, today])

  const recordAttempt = useCallback(
    async ({ answer, attempts, solved, grooveId, revealed }: DayProgress) => {
      const record: DailyResult = {
        date: today,
        answer,
        attempts,
        solved,
        grooveId,
        // Written only when the day was given up on, so the field stays absent
        // on every other record (E3 R9, R13).
        ...(revealed ? { revealed } : {}),
      }
      // Session state first, persistence second: a store that throws — quota,
      // disabled storage — must never cost the player the guess they just made
      // (R6, AC5). `createLocalStore` already swallows its own write failures;
      // this guards an injected store that does not.
      //
      // Unless the store keeps nothing by design. `all` is what the streak is
      // derived from, so merging a record that was never written would make a
      // shared groove advance a streak it did not earn: the panel would say
      // "streak now N+1" and a reload would take it back. A store that persists
      // nothing feeds nothing (F12 E1 R19, AC9).
      //
      // The record is still built and still handed to `save` — dropping the
      // write here instead would put the knowledge of a non-writing store in
      // two places, and `save` is the seam that is allowed to know.
      if (store.persists !== false) {
        setAll((prev) => [...prev.filter((x) => x.date !== record.date), record])
        setTodayResult(record)
      }
      try {
        await store.save(record)
      } catch {
        // Deliberately ignored — see above.
      }
    },
    [store, today],
  )

  const streak = useMemo(() => computeStreak(all, today), [all, today])

  return { todayResult, streak, recordAttempt, loaded, newOrLapsed }
}
