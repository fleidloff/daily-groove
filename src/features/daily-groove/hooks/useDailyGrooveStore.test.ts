import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Groove } from '../types'

// Mock scoring so the store's use of scoreSelected is observable and
// independent of the real implementation.
vi.mock('../lib/scoring', () => ({
  scoreSelected: vi.fn(),
}))

import { scoreSelected } from '../lib/scoring'
import { createDailyGrooveStore } from './useDailyGrooveStore'

const GROOVE: Groove = {
  id: 'groove-01',
  audioSrc: '/grooves/groove-01.mp3',
  scale: 'C minor',
  chord: 'Cm7',
  progression: 'Cm–Fm–G7',
}

describe('createDailyGrooveStore', () => {
  beforeEach(() => {
    vi.mocked(scoreSelected).mockReset()
  })

  it('starts with the groove and empty selection/guesses/result', () => {
    const store = createDailyGrooveStore(GROOVE)
    const state = store.getState()
    expect(state.groove).toBe(GROOVE)
    expect(state.selectedAttrs).toEqual([])
    expect(state.guesses).toEqual({})
    expect(state.submitted).toBe(false)
    expect(state.result).toBeNull()
  })

  it('toggleAttribute() adds an attribute, and toggling again removes it', () => {
    const store = createDailyGrooveStore(GROOVE)
    store.getState().toggleAttribute('scale')
    expect(store.getState().selectedAttrs).toEqual(['scale'])
    store.getState().toggleAttribute('chord')
    expect(store.getState().selectedAttrs).toEqual(['scale', 'chord'])
    store.getState().toggleAttribute('scale')
    expect(store.getState().selectedAttrs).toEqual(['chord'])
  })

  it('removing an attribute drops its recorded guess', () => {
    const store = createDailyGrooveStore(GROOVE)
    store.getState().toggleAttribute('scale')
    store.getState().setGuess('scale', 'C minor')
    expect(store.getState().guesses).toEqual({ scale: 'C minor' })
    store.getState().toggleAttribute('scale')
    expect(store.getState().guesses).toEqual({})
  })

  it('setGuess() records the value for an attribute', () => {
    const store = createDailyGrooveStore(GROOVE)
    store.getState().toggleAttribute('chord')
    store.getState().setGuess('chord', 'A7')
    expect(store.getState().guesses).toEqual({ chord: 'A7' })
  })

  it('submit() with no attribute selected is a no-op', () => {
    const store = createDailyGrooveStore(GROOVE)
    store.getState().submit()
    const state = store.getState()
    expect(state.submitted).toBe(false)
    expect(state.result).toBeNull()
    expect(scoreSelected).not.toHaveBeenCalled()
  })

  it('submit() builds a result over only the attempted attributes', () => {
    vi.mocked(scoreSelected).mockReturnValue({ scale: true, chord: false })
    const store = createDailyGrooveStore(GROOVE)
    store.getState().toggleAttribute('scale')
    store.getState().toggleAttribute('chord')
    store.getState().setGuess('scale', 'C minor')
    store.getState().setGuess('chord', 'A7')
    store.getState().submit()

    const state = store.getState()
    expect(state.submitted).toBe(true)
    expect(scoreSelected).toHaveBeenCalledWith(GROOVE, {
      scale: 'C minor',
      chord: 'A7',
    })
    expect(state.result?.guesses).toEqual({ scale: 'C minor', chord: 'A7' })
    expect(state.result?.correctness).toEqual({ scale: true, chord: false })
    // Progression was never attempted — no key for it anywhere.
    expect(Object.keys(state.result?.guesses ?? {})).toEqual(['scale', 'chord'])
    expect(state.result?.correctness.progression).toBeUndefined()
    expect(state.result?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('submit() is idempotent once submitted', () => {
    vi.mocked(scoreSelected).mockReturnValue({ scale: true })
    const store = createDailyGrooveStore(GROOVE)
    store.getState().toggleAttribute('scale')
    store.getState().setGuess('scale', 'C minor')
    store.getState().submit()
    store.getState().submit()
    expect(scoreSelected).toHaveBeenCalledTimes(1)
  })
})
