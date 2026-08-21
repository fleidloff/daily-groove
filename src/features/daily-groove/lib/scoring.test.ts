import { describe, it, expect } from 'vitest'
import type { Groove } from '../types'
import { scoreAttribute, scoreSelected } from './scoring'

const groove: Groove = {
  id: 'x',
  audioSrc: '/grooves/x.mp3',
  scale: 'C minor',
  chord: 'Cm7',
  progression: 'Cm–F–G',
}

describe('scoreAttribute', () => {
  it('returns true for an exact scale match', () => {
    expect(scoreAttribute(groove, 'scale', 'C minor')).toBe(true)
  })

  it('returns false for a wrong scale', () => {
    expect(scoreAttribute(groove, 'scale', 'A dorian')).toBe(false)
  })

  it('is exact string equality (case sensitive, no trimming)', () => {
    expect(scoreAttribute(groove, 'scale', 'c minor')).toBe(false)
    expect(scoreAttribute(groove, 'scale', 'C minor ')).toBe(false)
  })

  it('scores chord and progression attributes too', () => {
    expect(scoreAttribute(groove, 'chord', 'Cm7')).toBe(true)
    expect(scoreAttribute(groove, 'chord', 'Cmaj7')).toBe(false)
    expect(scoreAttribute(groove, 'progression', 'Cm–F–G')).toBe(true)
    expect(scoreAttribute(groove, 'progression', 'Am–D–G')).toBe(false)
  })
})

describe('scoreSelected', () => {
  const g: Groove = {
    id: 'y',
    audioSrc: '/grooves/y.mp3',
    scale: 'C minor',
    chord: 'Dmaj7',
    progression: 'Dm–G–C',
  }

  it('scores only the attempted attributes, with no key for the rest', () => {
    expect(scoreSelected(g, { scale: 'C minor', chord: 'A7' })).toEqual({
      scale: true,
      chord: false,
    })
  })

  it('does not include a key for un-attempted attributes', () => {
    const result = scoreSelected(g, { scale: 'C minor', chord: 'A7' })
    expect('progression' in result).toBe(false)
    expect(Object.keys(result).sort()).toEqual(['chord', 'scale'])
  })

  it('returns an empty map for an empty guesses object', () => {
    expect(scoreSelected(g, {})).toEqual({})
  })

  it('scores all three independently when all are attempted', () => {
    expect(
      scoreSelected(g, {
        scale: 'C minor',
        chord: 'Dmaj7',
        progression: 'Wrong',
      }),
    ).toEqual({ scale: true, chord: true, progression: false })
  })
})
