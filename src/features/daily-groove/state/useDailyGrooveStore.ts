import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Answer, Attempt, DailyResult, Flavour, Root } from '../types'
import { scoreAttempt, type FlavourMatcher } from '../lib/puzzle/scoring'

export type DailyGrooveState = {
  selectedRoot: Root | null
  selectedFlavour: Flavour | null
  attempts: Attempt[]
  solved: boolean
  /** The day ended without being solved: the player asked to see the answer. */
  revealed: boolean
  selectRoot(r: Root): void
  selectFlavour(f: Flavour): void
  check(): void
  /** End the day without solving it. Idempotent; a solved day ignores it. */
  reveal(): void
  /** Both chosen, the pair not just tried, and the day still open. */
  canCheck(): boolean
  /** Epic 5 restores a stored day through this; nothing calls it before then. */
  hydrate(result: DailyResult | null): void
}

/**
 * One vanilla Zustand store instance per puzzle, created in `GroovePuzzle` and
 * never a module singleton — deleting the feature folder leaves no global state
 * behind. The day's answer is closed over rather than held in state, so the
 * state shape stays exactly the contract Epics 3-5 build against.
 *
 * `matchFlavour` is how the flavour half is compared, and it is closed over the
 * same way. It defaults, through `scoreAttempt`, to the exact comparison, so a
 * one-argument call scores exactly as it always has. Simple mode passes a
 * looser one (F7 E5 R5). The store never learns what simple mode is: it holds a
 * comparison, not a difficulty.
 *
 * Callers that need to *change* the comparison mid-day pass a stable wrapper
 * that reads the current one at call time — it is invoked inside `check()`, not
 * captured at creation — so a switch costs no new store and no reset day
 * (F7 E5 R8).
 */
export function createDailyGrooveStore(
  answer: Answer,
  matchFlavour?: FlavourMatcher,
): StoreApi<DailyGrooveState> {
  return createStore<DailyGrooveState>((set, get) => ({
    selectedRoot: null,
    selectedFlavour: null,
    attempts: [],
    solved: false,
    revealed: false,

    selectRoot(r: Root) {
      // Single-select: the choice is replaced, never accumulated or emptied.
      if (get().solved) return
      set({ selectedRoot: r })
    },

    selectFlavour(f: Flavour) {
      if (get().solved) return
      set({ selectedFlavour: f })
    },

    reveal() {
      // A solved day has nothing to give up on, and the flag never unsets, so
      // pressing twice is the same as pressing once.
      if (get().solved) return
      set({ revealed: true })
    },

    canCheck() {
      const { selectedRoot, selectedFlavour, attempts, solved, revealed } = get()
      // Both endings close the day to further guesses.
      if (solved || revealed) return false
      if (selectedRoot === null || selectedFlavour === null) return false
      const last = attempts[attempts.length - 1]
      // The same pair can never be submitted twice in a row.
      if (last && last.root === selectedRoot && last.flavour === selectedFlavour) {
        return false
      }
      return true
    },

    check() {
      const { selectedRoot, selectedFlavour, attempts, canCheck } = get()
      if (!canCheck() || selectedRoot === null || selectedFlavour === null) {
        return
      }
      const attempt = scoreAttempt(
        answer,
        { root: selectedRoot, flavour: selectedFlavour },
        matchFlavour,
      )
      const next = [...attempts, attempt]
      const misses = next.filter((a) => !a.correct).length
      set({
        attempts: next,
        solved: attempt.correct,
        // The nudge has already named the day's root in prose by now, so the
        // second miss hands it over as a selection rather than leaving the
        // player to go and find the chip. Exactly two, not two-or-more: the
        // rule fires once, and a later miss leaves a root the player has since
        // chosen exactly where they put it (E3 R4, R5).
        ...(!attempt.correct && misses === 2 ? { selectedRoot: answer.root } : {}),
      })
    },

    hydrate(result: DailyResult | null) {
      if (result === null) {
        set({
          selectedRoot: null,
          selectedFlavour: null,
          attempts: [],
          solved: false,
          revealed: false,
        })
        return
      }
      const attempts = result.attempts ?? []
      const last = attempts[attempts.length - 1]
      set({
        attempts,
        solved: result.solved ?? attempts.some((a) => a.correct),
        // Absent on every record written before feature-7, which is a day that
        // was never given up on (E3 R13).
        revealed: result.revealed ?? false,
        selectedRoot: last?.root ?? null,
        selectedFlavour: last?.flavour ?? null,
      })
    },
  }))
}
