import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Answer, Attempt, DailyResult, Flavour, Root } from '../types'
import { scoreAttempt, type FlavourMatcher } from '../lib/puzzle/scoring'

export type DailyGrooveState = {
  selectedRoot: Root | null
  selectedFlavour: Flavour | null
  attempts: Attempt[]
  solved: boolean
  revealed: boolean
  selectRoot(r: Root): void
  selectFlavour(f: Flavour): void
  check(): void
  reveal(): void
  canCheck(): boolean
  hydrate(result: DailyResult | null): void
}

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
      if (get().solved) return
      set({ selectedRoot: r })
    },

    selectFlavour(f: Flavour) {
      if (get().solved) return
      set({ selectedFlavour: f })
    },

    reveal() {
      if (get().solved) return
      set({ revealed: true })
    },

    canCheck() {
      const { selectedRoot, selectedFlavour, attempts, solved, revealed } = get()
      if (solved || revealed) return false
      if (selectedRoot === null || selectedFlavour === null) return false
      const last = attempts[attempts.length - 1]
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
      set({
        attempts: next,
        solved: attempt.correct,
        ...(attempt.correct
          ? {}
          : {
              ...(attempt.rootMatched ? {} : { selectedRoot: null }),
              ...(attempt.flavourMatched ? {} : { selectedFlavour: null }),
            }),
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
        revealed: result.revealed ?? false,
        selectedRoot: last?.rootMatched ? last.root : null,
        selectedFlavour: last?.flavourMatched ? last.flavour : null,
      })
    },
  }))
}
