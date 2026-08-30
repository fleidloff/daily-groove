import { describe, expect, it } from 'vitest'
import type { Flavour } from '../types.ts'
import { FLAVOURS, INTERVALS, intervalsFor, pitchesOf, scaleName } from './scales.ts'

const ALL: Flavour[] = [
  'ionian',
  'aeolian',
  'dorian',
  'mixolydian',
  'lydian',
  'phrygian',
  'harmonic-minor',
  'blues',
]

describe('intervalsFor', () => {
  it('knows the natural minor', () => {
    expect(intervalsFor('aeolian')).toEqual([0, 2, 3, 5, 7, 8, 10])
  })

  it('knows the blues scale', () => {
    expect(intervalsFor('blues')).toEqual([0, 3, 5, 6, 7, 10])
  })

  it('knows the other six', () => {
    expect(intervalsFor('ionian')).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(intervalsFor('dorian')).toEqual([0, 2, 3, 5, 7, 9, 10])
    expect(intervalsFor('mixolydian')).toEqual([0, 2, 4, 5, 7, 9, 10])
    expect(intervalsFor('lydian')).toEqual([0, 2, 4, 6, 7, 9, 11])
    expect(intervalsFor('phrygian')).toEqual([0, 1, 3, 5, 7, 8, 10])
    expect(intervalsFor('harmonic-minor')).toEqual([0, 2, 3, 5, 7, 8, 11])
  })

  it('covers all eight flavours with ascending, distinct, in-octave intervals', () => {
    expect(FLAVOURS).toEqual(ALL)
    for (const flavour of ALL) {
      const intervals = intervalsFor(flavour)
      expect(intervals[0]).toBe(0)
      expect(new Set(intervals).size).toBe(intervals.length)
      for (let i = 1; i < intervals.length; i++) {
        expect(intervals[i]).toBeGreaterThan(intervals[i - 1])
        expect(intervals[i]).toBeLessThan(12)
      }
      expect(INTERVALS[flavour]).toEqual(intervals)
    }
  })

  it('throws on an unknown flavour', () => {
    expect(() => intervalsFor('bebop' as Flavour)).toThrow(/bebop/)
  })
})

/**
 * Epic 4 — the generator speaks modes. `major` and `minor` name the same seven
 * pitches as `ionian` and `aeolian`; the modal spellings are the ones the game
 * offers, so the old two must be gone from the vocabulary entirely.
 */
describe('the modal vocabulary', () => {
  it('offers ionian and aeolian, and neither major nor minor', () => {
    expect(FLAVOURS).toContain('ionian')
    expect(FLAVOURS).toContain('aeolian')
    expect(FLAVOURS).not.toContain('major')
    expect(FLAVOURS).not.toContain('minor')
  })

  it('keeps the two renamed flavours in the places they held', () => {
    // Order is what a seed's flavour draw depends on: a reordered list renders
    // different audio for an unchanged catalogue entry.
    expect(FLAVOURS[0]).toBe('ionian')
    expect(FLAVOURS[1]).toBe('aeolian')
  })

  it('gives ionian the major intervals and aeolian the natural-minor ones', () => {
    expect(intervalsFor('ionian')).toEqual([0, 2, 4, 5, 7, 9, 11])
    expect(intervalsFor('aeolian')).toEqual([0, 2, 3, 5, 7, 8, 10])
  })

  it('still spells harmonic minor with the word minor in it', () => {
    expect(FLAVOURS).toContain('harmonic-minor')
    expect(intervalsFor('harmonic-minor')).toEqual([0, 2, 3, 5, 7, 8, 11])
  })
})

describe('scaleName', () => {
  it('reads as a display string', () => {
    expect(scaleName('C', 'dorian')).toBe('C dorian')
    expect(scaleName('E♭', 'aeolian')).toBe('E♭ aeolian')
    expect(scaleName('C', 'ionian')).toBe('C ionian')
  })

  it('spells the hyphenated flavour as words', () => {
    expect(scaleName('A', 'harmonic-minor')).toBe('A harmonic minor')
  })
})

describe('pitchesOf', () => {
  it('returns the scale’s pitch classes transposed to the root', () => {
    expect(pitchesOf('C', 'aeolian')).toEqual([0, 2, 3, 5, 7, 8, 10])
    expect(pitchesOf('D', 'ionian')).toEqual([1, 2, 4, 6, 7, 9, 11])
  })

  it('always returns 0..11 values, ascending, for every root and flavour', () => {
    for (const flavour of ALL) {
      for (const root of ['C', 'F♯', 'B♭'] as const) {
        const pcs = pitchesOf(root, flavour)
        expect(pcs.length).toBe(intervalsFor(flavour).length)
        expect(new Set(pcs).size).toBe(pcs.length)
        for (const pc of pcs) {
          expect(pc).toBeGreaterThanOrEqual(0)
          expect(pc).toBeLessThan(12)
        }
        expect([...pcs].sort((a, b) => a - b)).toEqual(pcs)
      }
    }
  })
})
