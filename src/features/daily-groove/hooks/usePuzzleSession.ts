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
  /** Both halves chosen, the pair not just tried, and the day still open. */
  canCheck: boolean
  /** Score the chosen pair and persist the day. */
  check(): void
  /** The day ended without being solved: the player asked for the answer. */
  revealed: boolean
  /** End the day without solving it, and record it as given up. */
  reveal(): void
  /**
   * The day's correct pair, derived from the groove's own fields. Carried here
   * rather than re-derived by the view, so one derivation feeds the store, the
   * saved record and the reveal.
   */
  answer: Answer
  /** The player's current streak, derived from the saved results. */
  streak: number
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
 * `useProgress`, and the streak that write updates is returned with it, so
 * there is exactly one `useProgress` instance per puzzle and no second,
 * drifting copy of the saved results. The saved days themselves are not handed
 * out — nothing renders them, and the store still holds every one (E6 R3a).
 *
 * `simple` chooses how the flavour half is graded, and nothing else. It is not
 * part of the day: the groove, the answer and the attempts are the same in
 * either mode, which is why it reaches the store as a comparison rather than as
 * state (F7 E5 R5, R8).
 */
export function usePuzzleSession(
  groove: Groove,
  today: Date,
  simple = false,
): UsePuzzleSession {
  const todayIso = isoDate(today)
  const { streak, todayResult, loaded, recordAttempt } = useProgress(todayIso)

  // The answer is the groove's own `root` and `flavour` fields — the values
  // the generator wrote next to the audio, not a parse of its `scale` string.
  const answer = useMemo(() => answerOf(groove), [groove])

  // How the flavour half is compared, held in a ref rather than closed over by
  // the store. Switching mode mid-day must not recreate the store — that would
  // silently reset the day — so the store is handed a stable wrapper and reads
  // the current comparison at check time (F7 E5 R8, AC8). The ref is seeded
  // with the mode the session opens in and updated in an effect, so the very
  // first check already grades the right way.
  const matchFlavour: FlavourMatcher = simple ? familyMatch : exactMatch
  const matchRef = useRef<FlavourMatcher>(matchFlavour)
  useEffect(() => {
    matchRef.current = matchFlavour
  }, [matchFlavour])

  // One store instance per puzzle, created once. Held in state (not a ref) so it
  // is stable across renders without reading a ref during render. It is created
  // *empty*: the saved day arrives through `hydrate` below, so nothing here
  // reads localStorage synchronously and the async `ResultStore` seam survives.
  // `simple` is deliberately not a dependency of anything below: the day
  // outlives the mode it is being played in.
  // The wrapper handed to the store reads the ref when it is *called* — inside
  // `check()`, from an event handler — and never during render, which is the
  // hazard the rule guards. The alternative it would push towards, recreating
  // the store when the matcher changes, is the exact bug this ref exists to
  // avoid: it would reset the day on a mid-day switch.
  /* eslint-disable-next-line react-hooks/refs -- read at check time, not during render */
  const [store] = useState(() =>
    createDailyGrooveStore(answer, (a, guess) => matchRef.current(a, guess)),
  )

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
  const revealed = useStore(store, (s: DailyGrooveState) => s.revealed)
  const selectRoot = useStore(store, (s: DailyGrooveState) => s.selectRoot)
  const selectFlavour = useStore(store, (s: DailyGrooveState) => s.selectFlavour)
  const scoreSelection = useStore(store, (s: DailyGrooveState) => s.check)
  const revealDay = useStore(store, (s: DailyGrooveState) => s.reveal)

  // `canCheck` derives from state rather than being state, so it is recomputed
  // on every render the subscribed slices trigger.
  const canCheck = store.getState().canCheck()

  /**
   * Write the day as the store now holds it. Both endings share this shape, so
   * the attempt list and the outcome are always read back off the store rather
   * than assembled twice — the store is the only place that accumulates them.
   * The record remembers which groove the day played, so the row can replay it
   * later even after the catalogue has grown (E5 R7).
   */
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

  /**
   * Check the chosen pair, then persist the day. The record is written after
   * every check rather than only on a solve, so a reload mid-game comes back to
   * the attempts already spent (R2).
   */
  const check = useCallback(() => {
    const before = store.getState().attempts.length
    scoreSelection()
    // A rejected check (same pair, or a day already over) writes nothing.
    if (store.getState().attempts.length === before) return
    persist()
  }, [store, scoreSelection, persist])

  /**
   * End the day without solving it. The reveal is not an attempt, so the
   * attempt list is untouched; only the flag on the record changes, which is
   * what makes a given-up day survive a reload as one (E3 R7, R8, R9).
   */
  const reveal = useCallback(() => {
    if (store.getState().revealed) return
    revealDay()
    // A solved day ignores the action, and so writes nothing.
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
  }
}
