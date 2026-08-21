import { createStore, type StoreApi } from 'zustand/vanilla'
import type { Attribute, DailyResult, Groove } from '../types'
import { scoreSelected } from '../lib/scoring'
import { isoDate } from '../lib/selectGroove'

export type DailyGrooveState = {
  groove: Groove
  selectedAttrs: Attribute[]
  guesses: Partial<Record<Attribute, string>>
  submitted: boolean
  result: DailyResult | null
  toggleAttribute(a: Attribute): void
  setGuess(a: Attribute, value: string): void
  submit(): void // scores the attempted attributes, builds the DailyResult
}

/**
 * One vanilla Zustand store instance per puzzle. Holds the day's groove, the
 * set of attributes the player opted into, their pending guesses, and — once
 * submitted — the scored DailyResult over exactly the attempted attributes.
 * Epic 3 subscribes to persist; it does not replace this store.
 */
export function createDailyGrooveStore(
  groove: Groove,
): StoreApi<DailyGrooveState> {
  return createStore<DailyGrooveState>((set, get) => ({
    groove,
    selectedAttrs: [],
    guesses: {},
    submitted: false,
    result: null,
    toggleAttribute(a: Attribute) {
      const { selectedAttrs, guesses } = get()
      if (selectedAttrs.includes(a)) {
        // Remove the attribute and drop any guess recorded for it.
        const nextGuesses = { ...guesses }
        delete nextGuesses[a]
        set({
          selectedAttrs: selectedAttrs.filter((x) => x !== a),
          guesses: nextGuesses,
        })
      } else {
        set({ selectedAttrs: [...selectedAttrs, a] })
      }
    },
    setGuess(a: Attribute, value: string) {
      set({ guesses: { ...get().guesses, [a]: value } })
    },
    submit() {
      const { selectedAttrs, guesses, submitted, groove: current } = get()
      // No-op with nothing selected, and idempotent once submitted.
      if (selectedAttrs.length === 0 || submitted) return

      // Build guesses/correctness over exactly the attempted attributes.
      const attempted: Partial<Record<Attribute, string>> = {}
      for (const a of selectedAttrs) {
        const guess = guesses[a]
        if (guess !== undefined) attempted[a] = guess
      }

      const correctness = scoreSelected(current, attempted)
      const result: DailyResult = {
        date: isoDate(new Date()),
        guesses: attempted,
        correctness,
      }
      set({ submitted: true, result })
    },
  }))
}
