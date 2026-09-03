'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from 'zustand'
import type { Answer, Attempt, Flavour, Groove, Root } from '../types'
import {
  createDailyGrooveStore,
  type DailyGrooveState,
} from '../state/useDailyGrooveStore'
import {
  exactMatch,
  familyMatch,
  type FlavourMatcher,
} from '../lib/puzzle/scoring'
import { answerOf } from '@/lib/theory/music'
import { isoDate } from '@/lib/date'
import { useProgress } from './useProgress'
import type { ResultStore } from '../lib/persistence/storage'

export type UsePuzzleSession = {
  selectedRoot: Root | null
  selectedFlavour: Flavour | null
  attempts: Attempt[]
  solved: boolean
  hydrated: boolean
  selectRoot(r: Root): void
  selectFlavour(f: Flavour): void
  canCheck: boolean
  check(): void
  revealed: boolean
  reveal(): void
  answer: Answer
  streak: number
  newOrLapsed: boolean
}

export function usePuzzleSession(
  groove: Groove,
  today: Date,
  simple = false,
  resultStore?: ResultStore,
): UsePuzzleSession {
  const todayIso = isoDate(today)
  const { streak, todayResult, loaded, recordAttempt, newOrLapsed } =
    useProgress(todayIso, resultStore)

  const answer = useMemo(() => answerOf(groove), [groove])

  const matchFlavour: FlavourMatcher = simple ? familyMatch : exactMatch
  const matchRef = useRef<FlavourMatcher>(matchFlavour)
  useEffect(() => {
    matchRef.current = matchFlavour
  }, [matchFlavour])

  /* eslint-disable-next-line react-hooks/refs -- read at check time, not during render */
  const [store] = useState(() =>
    createDailyGrooveStore(answer, (a, guess) => matchRef.current(a, guess)),
  )

  const [hydrated, setHydrated] = useState(false)
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (!loaded || hydratedRef.current) return
    hydratedRef.current = true
    store.getState().hydrate(todayResult)
    setHydrated(true)
  }, [loaded, todayResult, store])

  const selectedRoot = useStore(store, (s: DailyGrooveState) => s.selectedRoot)
  const selectedFlavour = useStore(
    store,
    (s: DailyGrooveState) => s.selectedFlavour,
  )
  const attempts = useStore(store, (s: DailyGrooveState) => s.attempts)
  const solved = useStore(store, (s: DailyGrooveState) => s.solved)
  const revealed = useStore(store, (s: DailyGrooveState) => s.revealed)
  const selectRoot = useStore(store, (s: DailyGrooveState) => s.selectRoot)
  const selectFlavour = useStore(store, (s: DailyGrooveState) => s.selectFlavour)
  const scoreSelection = useStore(store, (s: DailyGrooveState) => s.check)
  const revealDay = useStore(store, (s: DailyGrooveState) => s.reveal)

  const canCheck = store.getState().canCheck()

  const persist = useCallback(() => {
    const { attempts: spent, solved: nowSolved, revealed: gaveUp } = store.getState()
    void recordAttempt({
      answer,
      attempts: spent,
      solved: nowSolved,
      grooveId: groove.id,
      ...(gaveUp ? { revealed: true as const } : {}),
    })
  }, [store, answer, recordAttempt, groove])

  const check = useCallback(() => {
    const before = store.getState().attempts.length
    scoreSelection()
    if (store.getState().attempts.length === before) return
    persist()
  }, [store, scoreSelection, persist])

  const reveal = useCallback(() => {
    if (store.getState().revealed) return
    revealDay()
    if (!store.getState().revealed) return
    persist()
  }, [store, revealDay, persist])

  return {
    selectedRoot,
    selectedFlavour,
    attempts,
    solved,
    hydrated,
    selectRoot,
    selectFlavour,
    canCheck,
    check,
    revealed,
    reveal,
    answer,
    streak,
    newOrLapsed,
  }
}
