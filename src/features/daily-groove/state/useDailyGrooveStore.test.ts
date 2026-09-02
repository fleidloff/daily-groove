import { describe, expect, it } from 'vitest'
import type { Answer, Attempt, DailyResult } from '../types'
import { createDailyGrooveStore } from './useDailyGrooveStore'
import {
  exactMatch,
  familyMatch,
  type FlavourMatcher,
} from '../lib/puzzle/scoring'

const ANSWER: Answer = { root: 'G', flavour: 'Dorian' }

function freshStore() {
  return createDailyGrooveStore(ANSWER)
}

describe('createDailyGrooveStore', () => {
  it('starts with nothing selected, no attempts and unsolved', () => {
    const state = freshStore().getState()
    expect(state.selectedRoot).toBeNull()
    expect(state.selectedFlavour).toBeNull()
    expect(state.attempts).toEqual([])
    expect(state.solved).toBe(false)
  })

  it('is created per instance, sharing no state between stores', () => {
    const a = freshStore()
    const b = freshStore()
    a.getState().selectRoot('C')
    expect(a.getState().selectedRoot).toBe('C')
    expect(b.getState().selectedRoot).toBeNull()
  })

  it('selectRoot() replaces rather than accumulates', () => {
    const store = freshStore()
    store.getState().selectRoot('G')
    expect(store.getState().selectedRoot).toBe('G')
    store.getState().selectRoot('C')
    expect(store.getState().selectedRoot).toBe('C')
  })

  it('selectFlavour() replaces rather than accumulates', () => {
    const store = freshStore()
    store.getState().selectFlavour('Dorian')
    expect(store.getState().selectedFlavour).toBe('Dorian')
    store.getState().selectFlavour('Mixolydian')
    expect(store.getState().selectedFlavour).toBe('Mixolydian')
  })

  it('the two groups select independently', () => {
    const store = freshStore()
    store.getState().selectRoot('G')
    store.getState().selectFlavour('Dorian')
    expect(store.getState().selectedRoot).toBe('G')
    expect(store.getState().selectedFlavour).toBe('Dorian')
  })

  describe('canCheck()', () => {
    it('is false with nothing selected', () => {
      expect(freshStore().getState().canCheck()).toBe(false)
    })

    it('is false with only a root selected', () => {
      const store = freshStore()
      store.getState().selectRoot('G')
      expect(store.getState().canCheck()).toBe(false)
    })

    it('is false with only a flavour selected', () => {
      const store = freshStore()
      store.getState().selectFlavour('Dorian')
      expect(store.getState().canCheck()).toBe(false)
    })

    it('is true once both halves are chosen', () => {
      const store = freshStore()
      store.getState().selectRoot('G')
      store.getState().selectFlavour('Dorian')
      expect(store.getState().canCheck()).toBe(true)
    })
  })

  describe('check()', () => {
    it('records a wrong attempt with its half matches', () => {
      const store = freshStore()
      store.getState().selectRoot('G')
      store.getState().selectFlavour('Mixolydian')
      store.getState().check()

      const { attempts, solved } = store.getState()
      expect(attempts).toEqual<Attempt[]>([
        {
          root: 'G',
          flavour: 'Mixolydian',
          correct: false,
          rootMatched: true,
          flavourMatched: false,
        },
      ])
      expect(solved).toBe(false)
    })

    it('keeps the half a wrong check confirmed and drops the half it ruled out', () => {
      const store = freshStore()
      store.getState().selectRoot('G')
      store.getState().selectFlavour('Mixolydian')
      store.getState().check()
      expect(store.getState().selectedRoot).toBe('G')
      expect(store.getState().selectedFlavour).toBeNull()
    })

    it('does nothing when both halves are not chosen', () => {
      const store = freshStore()
      store.getState().selectRoot('G')
      store.getState().check()
      expect(store.getState().attempts).toEqual([])
    })

    it('blocks re-checking the same pair until a selection changes', () => {
      const store = freshStore()
      store.getState().selectRoot('G')
      store.getState().selectFlavour('Mixolydian')
      store.getState().check()

      expect(store.getState().canCheck()).toBe(false)
      store.getState().check()
      expect(store.getState().attempts).toHaveLength(1)

      store.getState().selectFlavour('Dorian')
      expect(store.getState().canCheck()).toBe(true)
    })

    it('unblocks when the root changes instead', () => {
      const store = freshStore()
      store.getState().selectRoot('C')
      store.getState().selectFlavour('Mixolydian')
      store.getState().check()
      expect(store.getState().canCheck()).toBe(false)
      store.getState().selectFlavour('Mixolydian')
      expect(store.getState().canCheck()).toBe(false)
      store.getState().selectRoot('D')
      expect(store.getState().canCheck()).toBe(true)
    })

    it('re-blocks when the player returns to the pair just tried', () => {
      const store = freshStore()
      store.getState().selectRoot('G')
      store.getState().selectFlavour('Mixolydian')
      store.getState().check()
      store.getState().selectFlavour('Dorian')
      store.getState().selectFlavour('Mixolydian')
      expect(store.getState().canCheck()).toBe(false)
    })
  })

  describe('once solved', () => {
    function solvedStore() {
      const store = freshStore()
      store.getState().selectRoot('G')
      store.getState().selectFlavour('Dorian')
      store.getState().check()
      return store
    }

    it('marks the day solved on the correct pair', () => {
      const store = solvedStore()
      expect(store.getState().solved).toBe(true)
      expect(store.getState().attempts.at(-1)?.correct).toBe(true)
    })

    it('canCheck() is false', () => {
      expect(solvedStore().getState().canCheck()).toBe(false)
    })

    it('the chips stop accepting input', () => {
      const store = solvedStore()
      store.getState().selectRoot('C')
      store.getState().selectFlavour('Locrian')
      expect(store.getState().selectedRoot).toBe('G')
      expect(store.getState().selectedFlavour).toBe('Dorian')
    })

    it('check() records no further attempts', () => {
      const store = solvedStore()
      store.getState().check()
      expect(store.getState().attempts).toHaveLength(1)
    })
  })

  describe('hydrate()', () => {
    const attempt: Attempt = {
      root: 'G',
      flavour: 'Mixolydian',
      correct: false,
      rootMatched: true,
      flavourMatched: false,
    }
    const result: DailyResult = {
      date: '2026-08-29',
      answer: ANSWER,
      attempts: [attempt],
      solved: false,
    }

    it('restores a stored day, keeping only the half its last check confirmed', () => {
      const store = freshStore()
      store.getState().hydrate(result)
      const state = store.getState()
      expect(state.attempts).toEqual([attempt])
      expect(state.selectedRoot).toBe('G')
      expect(state.selectedFlavour).toBeNull()
      expect(state.solved).toBe(false)
      expect(state.canCheck()).toBe(false)
    })

    it('restores neither half when the last stored check missed both', () => {
      const store = freshStore()
      store.getState().hydrate({
        ...result,
        attempts: [{ ...attempt, root: 'C', rootMatched: false }],
      })
      expect(store.getState().selectedRoot).toBeNull()
      expect(store.getState().selectedFlavour).toBeNull()
    })

    it('restores both halves of a solved record', () => {
      const store = freshStore()
      store.getState().hydrate({
        ...result,
        attempts: [{ ...attempt, flavour: 'Dorian', correct: true, flavourMatched: true }],
        solved: true,
      })
      expect(store.getState().selectedRoot).toBe('G')
      expect(store.getState().selectedFlavour).toBe('Dorian')
    })

    it('restores no selection from a record whose halves cannot be read', () => {
      const store = freshStore()
      const legacy = { root: 'G', flavour: 'Mixolydian', correct: false } as Attempt
      store.getState().hydrate({ ...result, attempts: [legacy] })
      expect(store.getState().selectedRoot).toBeNull()
      expect(store.getState().selectedFlavour).toBeNull()
    })

    it('restores a solved day as locked', () => {
      const store = freshStore()
      store.getState().hydrate({
        ...result,
        attempts: [{ ...attempt, flavour: 'Dorian', correct: true, flavourMatched: true }],
        solved: true,
      })
      expect(store.getState().solved).toBe(true)
      expect(store.getState().canCheck()).toBe(false)
    })

    it('hydrating null leaves a clean day', () => {
      const store = freshStore()
      store.getState().hydrate(null)
      const state = store.getState()
      expect(state.attempts).toEqual([])
      expect(state.selectedRoot).toBeNull()
      expect(state.selectedFlavour).toBeNull()
      expect(state.solved).toBe(false)
    })
  })

  describe('reveal()', () => {
    it('ends the day without solving it, and spends no attempt', () => {
      const store = freshStore()
      store.getState().selectRoot('G')
      store.getState().selectFlavour('Mixolydian')
      store.getState().check()
      const spent = store.getState().attempts

      store.getState().reveal()

      const state = store.getState()
      expect(state.revealed).toBe(true)
      expect(state.solved).toBe(false)
      expect(state.attempts).toEqual(spent)
    })

    it('starts false on a fresh day', () => {
      expect(freshStore().getState().revealed).toBe(false)
    })

    it('takes no further guess once revealed', () => {
      const store = freshStore()
      store.getState().selectRoot('G')
      store.getState().selectFlavour('Mixolydian')
      store.getState().check()

      store.getState().reveal()

      store.getState().selectFlavour('Dorian')
      expect(store.getState().canCheck()).toBe(false)
      store.getState().check()
      expect(store.getState().attempts).toHaveLength(1)
    })

    it('is idempotent', () => {
      const store = freshStore()
      store.getState().reveal()
      store.getState().reveal()
      expect(store.getState().revealed).toBe(true)
      expect(store.getState().attempts).toEqual([])
    })

    it('a solved day ignores it', () => {
      const store = freshStore()
      store.getState().selectRoot('G')
      store.getState().selectFlavour('Dorian')
      store.getState().check()
      expect(store.getState().solved).toBe(true)

      store.getState().reveal()

      expect(store.getState().revealed).toBe(false)
      expect(store.getState().solved).toBe(true)
    })
  })

  describe('a miss clears the half it ruled out', () => {
    const E_DORIAN: Answer = { root: 'E', flavour: 'Dorian' }

    it("never selects the day's root on the player's behalf", () => {
      const store = createDailyGrooveStore(E_DORIAN)
      const roots = ['C', 'D', 'F'] as const

      for (const root of roots) {
        store.getState().selectRoot(root)
        store.getState().selectFlavour('Mixolydian')
        expect(store.getState().canCheck()).toBe(true)
        store.getState().check()
        expect(store.getState().selectedRoot).not.toBe('E')
        expect(store.getState().selectedRoot).toBeNull()
      }

      expect(store.getState().attempts).toHaveLength(3)
    })

    it('keeps the root and clears the mode when only the mode was wrong', () => {
      const store = createDailyGrooveStore(E_DORIAN)
      store.getState().selectRoot('E')
      store.getState().selectFlavour('Mixolydian')
      store.getState().check()

      expect(store.getState().selectedRoot).toBe('E')
      expect(store.getState().selectedFlavour).toBeNull()
    })

    it('keeps the mode and clears the root when only the root was wrong', () => {
      const store = createDailyGrooveStore(E_DORIAN)
      store.getState().selectRoot('C')
      store.getState().selectFlavour('Dorian')
      store.getState().check()

      expect(store.getState().selectedRoot).toBeNull()
      expect(store.getState().selectedFlavour).toBe('Dorian')
    })

    it('clears both when both halves were wrong', () => {
      const store = createDailyGrooveStore(E_DORIAN)
      store.getState().selectRoot('C')
      store.getState().selectFlavour('Mixolydian')
      store.getState().check()

      expect(store.getState().selectedRoot).toBeNull()
      expect(store.getState().selectedFlavour).toBeNull()
    })

    it('scores and records a fourth miss like the first', () => {
      const store = createDailyGrooveStore(E_DORIAN)
      const flavours = ['Mixolydian', 'Lydian', 'Mixolydian', 'Lydian']
      for (const [i, flavour] of flavours.entries()) {
        store.getState().selectRoot((['C', 'D', 'F', 'G'] as const)[i])
        store.getState().selectFlavour(flavour)
        expect(store.getState().canCheck()).toBe(true)
        store.getState().check()
      }

      expect(store.getState().attempts).toHaveLength(4)
      expect(store.getState().attempts.every((a) => !a.correct)).toBe(true)
      expect(store.getState().solved).toBe(false)
    })

    it('keeps the pair that won when the guess solves the day', () => {
      const store = createDailyGrooveStore(E_DORIAN)
      store.getState().selectRoot('C')
      store.getState().selectFlavour('Mixolydian')
      store.getState().check()
      store.getState().selectRoot('E')
      store.getState().selectFlavour('Dorian')
      store.getState().check()

      expect(store.getState().solved).toBe(true)
      expect(store.getState().selectedRoot).toBe('E')
      expect(store.getState().selectedFlavour).toBe('Dorian')
    })
  })

  describe('hydrate() and the reveal (Step B3 — E3 R8, R9, R13, AC9, AC13)', () => {
    const missed: Attempt = {
      root: 'C',
      flavour: 'Mixolydian',
      correct: false,
      rootMatched: false,
      flavourMatched: false,
    }
    const stored: DailyResult = {
      date: '2026-08-30',
      answer: ANSWER,
      attempts: [missed, missed, missed],
      solved: false,
    }

    it('restores a revealed day as over', () => {
      const store = freshStore()
      store.getState().hydrate({ ...stored, revealed: true })

      expect(store.getState().revealed).toBe(true)
      expect(store.getState().solved).toBe(false)
      expect(store.getState().canCheck()).toBe(false)
    })

    it('a record written without the flag loads as an unrevealed day', () => {
      const store = freshStore()
      store.getState().hydrate(stored)

      expect(store.getState().revealed).toBe(false)
    })

    it('clears a reveal when the day is hydrated afresh', () => {
      const store = freshStore()
      store.getState().hydrate({ ...stored, revealed: true })
      store.getState().hydrate(stored)
      expect(store.getState().revealed).toBe(false)

      store.getState().hydrate({ ...stored, revealed: true })
      store.getState().hydrate(null)
      expect(store.getState().revealed).toBe(false)
    })
  })

  describe('the flavour matcher', () => {
    it('grades exactly when none is given, as it always has', () => {
      const store = createDailyGrooveStore(ANSWER)
      store.getState().selectRoot('G')
      store.getState().selectFlavour('Minor')
      store.getState().check()

      const [attempt] = store.getState().attempts
      expect(attempt.flavourMatched).toBe(false)
      expect(attempt.correct).toBe(false)
      expect(store.getState().solved).toBe(false)
    })

    it("solves a Dorian day from its root and the minor family (AC4)", () => {
      const store = createDailyGrooveStore(ANSWER, familyMatch)
      store.getState().selectRoot('G')
      store.getState().selectFlavour('Minor')
      store.getState().check()

      const [attempt] = store.getState().attempts
      expect(attempt.flavourMatched).toBe(true)
      expect(attempt.correct).toBe(true)
      expect(store.getState().solved).toBe(true)
      expect(attempt.flavour).toBe('Minor')
    })

    it('misses a major-family guess on a minor day (AC5)', () => {
      const store = createDailyGrooveStore(ANSWER, familyMatch)
      store.getState().selectRoot('G')
      store.getState().selectFlavour('Major')
      store.getState().check()

      expect(store.getState().attempts[0].correct).toBe(false)
      expect(store.getState().solved).toBe(false)
    })

    it('reads the matcher at check time, so swapping it needs no new store', () => {
      let current: FlavourMatcher = exactMatch
      const store = createDailyGrooveStore(ANSWER, (answer, guess) =>
        current(answer, guess),
      )

      store.getState().selectRoot('C')
      store.getState().selectFlavour('Minor')
      store.getState().check()
      expect(store.getState().attempts).toHaveLength(1)
      expect(store.getState().solved).toBe(false)

      current = familyMatch
      store.getState().selectRoot('G')
      store.getState().selectFlavour('Minor')
      store.getState().check()
      expect(store.getState().attempts).toHaveLength(2)
      expect(store.getState().solved).toBe(true)
    })
  })
})
