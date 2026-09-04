import { describe, expect, it } from 'vitest'
import { UnknownFlavourError, UnknownRootError, pitchClassOfNote, scaleNotes } from './notes'
import { ROOTS } from './roots'
import { FLAVOUR_INTERVALS } from './scales'

describe('scaleNotes', () => {
  it('spells G Dorian', () => {
    expect(scaleNotes({ root: 'G', flavour: 'Dorian' })).toEqual([
      'G',
      'A',
      'B♭',
      'C',
      'D',
      'E',
      'F',
    ])
  })

  it('spells F Lydian, which needs no accidental at all', () => {
    expect(scaleNotes({ root: 'F', flavour: 'Lydian' })).toEqual([
      'F',
      'G',
      'A',
      'B',
      'C',
      'D',
      'E',
    ])
  })

  it('spells every root and flavour without repeating or skipping a letter', () => {
    for (const root of ROOTS) {
      for (const [flavour, intervals] of Object.entries(FLAVOUR_INTERVALS)) {
        const notes = scaleNotes({ root, flavour })
        const label = `${root} ${flavour}`
        expect(notes, label).toHaveLength(intervals.length)
        expect(notes[0], label).toBe(root)
        if (intervals.length === 7) {
          expect(new Set(notes.map((n) => n[0])).size, label).toBe(7)
        }
      }
    }
  })

  it('gives the seeded natural-root scales their conventional accidentals', () => {
    expect(scaleNotes({ root: 'C', flavour: 'Aeolian' })).toEqual([
      'C', 'D', 'E\u266d', 'F', 'G', 'A\u266d', 'B\u266d',
    ])
    expect(scaleNotes({ root: 'D', flavour: 'Ionian' })).toEqual([
      'D', 'E', 'F\u266f', 'G', 'A', 'B', 'C\u266f',
    ])
    expect(scaleNotes({ root: 'F', flavour: 'Lydian' })).toEqual([
      'F', 'G', 'A', 'B', 'C', 'D', 'E',
    ])
  })

  it('spells as many distinct notes as a flavour has degrees, from every root', () => {
    for (const [flavour, intervals] of Object.entries(FLAVOUR_INTERVALS)) {
      for (const root of ROOTS) {
        const label = `${root} ${flavour}`
        const notes = scaleNotes({ root, flavour })

        expect(notes, label).toHaveLength(intervals.length)
        expect(notes[0], label).toBe(root)
        expect(new Set(notes).size, label).toBe(intervals.length)
        if (intervals.length === 7) {
          expect(new Set(notes.map((n) => n[0])).size, label).toBe(7)
        }
        for (const note of notes) expect(note.length, label).toBeGreaterThan(0)
      }
    }
  })

  it('spells B Locrian, the flavour most easily forgotten', () => {
    expect(scaleNotes({ root: 'B', flavour: 'Locrian' })).toEqual([
      'B',
      'C',
      'D',
      'E',
      'F',
      'G',
      'A',
    ])
  })

  it('returns seven distinct notes from every chromatic root', () => {
    for (const root of ROOTS) {
      const notes = scaleNotes({ root, flavour: 'Aeolian' })
      expect(notes, root).toHaveLength(7)
      expect(new Set(notes).size, root).toBe(7)
    }
  })

  it('keeps the root as given and spells one letter per degree', () => {
    expect(scaleNotes({ root: 'C\u266f', flavour: 'Aeolian' })).toEqual([
      'C\u266f',
      'D\u266f',
      'E',
      'F\u266f',
      'G\u266f',
      'A',
      'B',
    ])
    expect(scaleNotes({ root: 'E\u266d', flavour: 'Lydian' })[0]).toBe('E\u266d')
  })

  it('spells A Dorian with a sharpened sixth, not a flattened seventh letter', () => {
    expect(scaleNotes({ root: 'A', flavour: 'Dorian' })).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F\u266f',
      'G',
    ])
  })

  it('is case-insensitive about the flavour', () => {
    expect(scaleNotes({ root: 'G', flavour: 'dorian' })).toEqual(
      scaleNotes({ root: 'G', flavour: 'Dorian' }),
    )
  })

  it('throws a named error for an unknown flavour rather than a short array', () => {
    expect(() => scaleNotes({ root: 'C', flavour: 'Bebop' })).toThrow(
      UnknownFlavourError,
    )
    expect(() => scaleNotes({ root: 'C', flavour: 'Bebop' })).toThrow(/Bebop/)
  })
})

describe('FLAVOUR_INTERVALS', () => {
  it('starts every flavour on the root, ascending and inside the octave', () => {
    for (const [flavour, intervals] of Object.entries(FLAVOUR_INTERVALS)) {
      expect(intervals.length, flavour).toBeGreaterThanOrEqual(5)
      expect(intervals[0], flavour).toBe(0)
      expect([...intervals].sort((a, b) => a - b), flavour).toEqual(intervals)
      expect(new Set(intervals).size, flavour).toBe(intervals.length)
      for (const i of intervals) expect(i, flavour).toBeLessThan(12)
    }
  })

  it('gives every seven-note flavour exactly seven degrees', () => {
    const heptatonic = Object.entries(FLAVOUR_INTERVALS).filter(
      ([flavour]) => flavour !== 'Blues',
    )
    expect(heptatonic.length).toBeGreaterThan(0)
    for (const [flavour, intervals] of heptatonic) {
      expect(intervals, flavour).toHaveLength(7)
    }
  })
})

describe('pitchClassOfNote', () => {
  it('reads a letter and its accidental as a pitch class (F23 E2 R3)', () => {
    expect(pitchClassOfNote('C')).toBe(0)
    expect(pitchClassOfNote('G♭')).toBe(6)
    expect(pitchClassOfNote('F♯')).toBe(6)
    expect(pitchClassOfNote('B♯')).toBe(0)
    expect(pitchClassOfNote('C♭')).toBe(11)
    expect(pitchClassOfNote('E♭♭')).toBe(2)
  })

  it('agrees with ROOTS for every root the app spells', () => {
    ROOTS.forEach((root, index) => expect(pitchClassOfNote(root)).toBe(index))
  })

  it('rejects what is not a spelt note', () => {
    expect(() => pitchClassOfNote('H')).toThrow(UnknownRootError)
    expect(() => pitchClassOfNote('C♮')).toThrow(UnknownRootError)
  })
})
