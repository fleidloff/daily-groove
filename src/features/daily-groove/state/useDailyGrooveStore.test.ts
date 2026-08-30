import { describe, expect, it } from 'vitest'
import type { Answer, Attempt, DailyResult } from '../types'
import { createDailyGrooveStore } from './useDailyGrooveStore'

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

    it('keeps both chips selected after a wrong check', () => {
      const store = freshStore()
      store.getState().selectRoot('G')
      store.getState().selectFlavour('Mixolydian')
      store.getState().check()
      expect(store.getState().selectedRoot).toBe('G')
      expect(store.getState().selectedFlavour).toBe('Mixolydian')
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

    it('restores a stored day', () => {
      const store = freshStore()
      store.getState().hydrate(result)
      const state = store.getState()
      expect(state.attempts).toEqual([attempt])
      expect(state.selectedRoot).toBe('G')
      expect(state.selectedFlavour).toBe('Mixolydian')
      expect(state.solved).toBe(false)
      // The restored pair was already tried, so it cannot be re-checked.
      expect(state.canCheck()).toBe(false)
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
})
