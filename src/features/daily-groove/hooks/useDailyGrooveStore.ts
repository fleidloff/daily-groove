import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Answer, Attempt, DailyResult, Flavour, Root } from '../types'
import { scoreAttempt } from '../lib/scoring'

export type DailyGrooveState = {
  selectedRoot: Root | null
  selectedFlavour: Flavour | null
  attempts: Attempt[]
  solved: boolean
  selectRoot(r: Root): void
  selectFlavour(f: Flavour): void
  check(): void
  /** Both chosen, the pair not just tried, and the day unsolved. */
  canCheck(): boolean
  /** Epic 5 restores a stored day through this; nothing calls it before then. */
  hydrate(result: DailyResult | null): void
}

/**
 * One vanilla Zustand store instance per puzzle, created in `GroovePuzzle` and
 * never a module singleton — deleting the feature folder leaves no global state
 * behind. The day's answer is closed over rather than held in state, so the
 * state shape stays exactly the contract Epics 3-5 build against.
 */
export function createDailyGrooveStore(
  answer: Answer,
): StoreApi<DailyGrooveState> {
  return createStore<DailyGrooveState>((set, get) => ({
    selectedRoot: null,
    selectedFlavour: null,
    attempts: [],
    solved: false,

    selectRoot(r: Root) {
      // Single-select: the choice is replaced, never accumulated or emptied.
      if (get().solved) return
      set({ selectedRoot: r })
    },

    selectFlavour(f: Flavour) {
      if (get().solved) return
      set({ selectedFlavour: f })
    },

    canCheck() {
      const { selectedRoot, selectedFlavour, attempts, solved } = get()
      if (solved) return false
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
      const attempt = scoreAttempt(answer, {
        root: selectedRoot,
        flavour: selectedFlavour,
      })
      set({ attempts: [...attempts, attempt], solved: attempt.correct })
    },

    hydrate(result: DailyResult | null) {
      if (result === null) {
        set({
          selectedRoot: null,
          selectedFlavour: null,
          attempts: [],
          solved: false,
        })
        return
      }
      const attempts = result.attempts ?? []
      const last = attempts[attempts.length - 1]
      set({
        attempts,
        solved: result.solved ?? attempts.some((a) => a.correct),
        selectedRoot: last?.root ?? null,
        selectedFlavour: last?.flavour ?? null,
      })
    },
  }))
}
