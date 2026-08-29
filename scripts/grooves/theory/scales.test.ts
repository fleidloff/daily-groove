import { describe, expect, it } from 'vitest'
import type { Flavour } from '../types.ts'
import { FLAVOURS, INTERVALS, intervalsFor, pitchesOf, scaleName } from './scales.ts'

const ALL: Flavour[] = [
  'major',
  'minor',
  'dorian',
  'mixolydian',
  'lydian',
  'phrygian',
  'harmonic-minor',
  'blues',
]

describe('intervalsFor', () => {
  it('knows the natural minor', () => {
    expect(intervalsFor('minor')).toEqual([0, 2, 3, 5, 7, 8, 10])
  })

  it('knows the blues scale', () => {
    expect(intervalsFor('blues')).toEqual([0, 3, 5, 6, 7, 10])
  })

  it('knows the other six', () => {
    expect(intervalsFor('major')).toEqual([0, 2, 4, 5, 7, 9, 11])
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

describe('scaleName', () => {
  it('reads as a display string', () => {
    expect(scaleName('C', 'dorian')).toBe('C dorian')
    expect(scaleName('E♭', 'minor')).toBe('E♭ minor')
  })

  it('spells the hyphenated flavour as words', () => {
    expect(scaleName('A', 'harmonic-minor')).toBe('A harmonic minor')
  })
})

describe('pitchesOf', () => {
  it('returns the scale’s pitch classes transposed to the root', () => {
    expect(pitchesOf('C', 'minor')).toEqual([0, 2, 3, 5, 7, 8, 10])
    expect(pitchesOf('D', 'major')).toEqual([1, 2, 4, 6, 7, 9, 11])
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
