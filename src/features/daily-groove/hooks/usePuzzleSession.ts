'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from 'zustand'
import type {
  Answer,
  Attempt,
  DailyResult,
  Flavour,
  Groove,
  Root,
} from '../types'
import {
  createDailyGrooveStore,
  type DailyGrooveState,
} from '../state/useDailyGrooveStore'
import { answerOf } from '../lib/theory/music'
import { isoDate } from '../lib/puzzle/selectGroove'
import { useProgress } from './useProgress'

export type UsePuzzleSession = {
  selectedRoot: Root | null
  selectedFlavour: Flavour | null
  attempts: Attempt[]
  solved: boolean
  /** True once the day's saved record has been read into the session. */
  hydrated: boolean
  selectRoot(r: Root): void
  selectFlavour(f: Flavour): void
  /** Both halves chosen, the pair not just tried, and the day unsolved. */
  canCheck: boolean
  /** Score the chosen pair and persist the day. */
  check(): void
  /**
   * The day's correct pair, derived from the groove's own fields. Carried here
   * rather than re-derived by the view, so one derivation feeds the store, the
   * saved record and the reveal.
   */
  answer: Answer
  /** The player's current streak, derived from the saved results. */
  streak: number
  /** Every saved day, most recent first. */
  history: DailyResult[]
}

/**
 * One day's play, as a flat value object.
 *
 * The Zustand store is an implementation detail: it is created here, read here,
 * and never handed out — no consumer and no test reaches `StoreApi`, and
 * `useStore` is not called anywhere else in the feature. `createDailyGrooveStore`
 * stays in `state/`, so it keeps its own unit test.
 *
 * Progress lives behind the same seam. `check` writes the day through
 * `useProgress`, and the streak and history that write updates are returned
 * with it, so there is exactly one `useProgress` instance per puzzle and no
 * second, drifting copy of the saved results.
 */
export function usePuzzleSession(groove: Groove, today: Date): UsePuzzleSession {
  const todayIso = isoDate(today)
  const { streak, history, todayResult, loaded, recordAttempt } =
    useProgress(todayIso)

  // The answer is the groove's own `root` and `flavour` fields — the values
  // the generator wrote next to the audio, not a parse of its `scale` string.
  const answer = useMemo(() => answerOf(groove), [groove])

  // One store instance per puzzle, created once. Held in state (not a ref) so it
  // is stable across renders without reading a ref during render. It is created
  // *empty*: the saved day arrives through `hydrate` below, so nothing here
  // reads localStorage synchronously and the async `ResultStore` seam survives.
  const [store] = useState(() => createDailyGrooveStore(answer))

  // Restoration, exactly once. `todayResult` changes again on every write, and
  // re-hydrating then would overwrite a selection the player has since made —
  // so the latch is a ref, not a dependency.
  const [hydrated, setHydrated] = useState(false)
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (!loaded || hydratedRef.current) return
    hydratedRef.current = true
    store.getState().hydrate(todayResult)
    // Gates the first game frame on the store read: the view keeps its loading
    // state up until this has run.
    setHydrated(true)
  }, [loaded, todayResult, store])

  const selectedRoot = useStore(store, (s: DailyGrooveState) => s.selectedRoot)
  const selectedFlavour = useStore(
    store,
    (s: DailyGrooveState) => s.selectedFlavour,
  )
  const attempts = useStore(store, (s: DailyGrooveState) => s.attempts)
  const solved = useStore(store, (s: DailyGrooveState) => s.solved)
  const selectRoot = useStore(store, (s: DailyGrooveState) => s.selectRoot)
  const selectFlavour = useStore(store, (s: DailyGrooveState) => s.selectFlavour)
  const scoreSelection = useStore(store, (s: DailyGrooveState) => s.check)

  // `canCheck` derives from state rather than being state, so it is recomputed
  // on every render the subscribed slices trigger.
  const canCheck = store.getState().canCheck()

  /**
   * Check the chosen pair, then persist the day. The record is written after
   * every check rather than only on a solve, so a reload mid-game comes back to
   * the attempts already spent (R2). The attempt list is read back off the
   * store, which is the only place that accumulates it.
   */
  const check = useCallback(() => {
    const before = store.getState().attempts.length
    scoreSelection()
    const { attempts: after, solved: nowSolved } = store.getState()
    // A rejected check (same pair, or an already-solved day) writes nothing.
    if (after.length === before) return
    // The record remembers which groove the day played, so the row can replay
    // it later even after the catalogue has grown (E5 R7).
    void recordAttempt({
      answer,
      attempts: after,
      solved: nowSolved,
      grooveId: groove.id,
    })
  }, [store, scoreSelection, answer, recordAttempt, groove])

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
    answer,
    streak,
    history,
  }
}
