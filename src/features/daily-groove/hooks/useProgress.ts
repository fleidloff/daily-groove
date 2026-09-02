'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Answer, Attempt, DailyResult } from '../types'
import { createLocalStore, type ResultStore } from '../lib/persistence/storage'
import { isNewOrLapsed } from '../lib/persistence/lapsed'
import { computeStreak } from '../lib/persistence/streak'

const defaultStore: ResultStore = createLocalStore()

export type DayProgress = {
  answer: Answer
  attempts: Attempt[]
  solved: boolean
  grooveId: string
  revealed?: boolean
}

export type UseProgress = {
  todayResult: DailyResult | null
  streak: number
  recordAttempt: (day: DayProgress) => Promise<void>
  loaded: boolean
  newOrLapsed: boolean
}

export function useProgress(
  today: string,
  store: ResultStore = defaultStore,
): UseProgress {
  const [all, setAll] = useState<DailyResult[]>([])
  const [todayResult, setTodayResult] = useState<DailyResult | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [newOrLapsed, setNewOrLapsed] = useState(false)

  useEffect(() => {
    let active = true
    /* eslint-disable react-hooks/set-state-in-effect -- async data load, unmount-guarded */
    setLoaded(false)
    Promise.all([store.getAll(), store.get(today)]).then(
      ([allResults, todays]) => {
        if (!active) return
        setAll(allResults)
        setTodayResult(todays)
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
        ...(revealed ? { revealed } : {}),
      }
      if (store.persists !== false) {
        setAll((prev) => [...prev.filter((x) => x.date !== record.date), record])
        setTodayResult(record)
      }
      try {
        await store.save(record)
      } catch {
        // A failed write must not cost the player the guess they just made.
      }
    },
    [store, today],
  )

  const streak = useMemo(() => computeStreak(all, today), [all, today])

  return { todayResult, streak, recordAttempt, loaded, newOrLapsed }
}
