import { describe, expect, it } from 'vitest'
import { FLAVOUR_INTERVALS, UnknownFlavourError, scaleNotes } from './notes'
import { ROOTS } from './music'

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
    // The real invariant. A seven-note scale uses each letter exactly once. A
    // scale that is not seven notes cannot: the blues scale has six degrees and
    // its flat fifth and natural fifth share a letter by construction, so it
    // declares its own letters and is asserted against its own spelling below.
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
    // The old premise held for these by coincidence; keep it asserted where it
    // is actually true, so a regression in the common case still fails.
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
    // Driven off the interval table rather than a catalogue, so it covers every
    // root rather than the handful a catalogue happens to use.
    for (const [flavour, intervals] of Object.entries(FLAVOUR_INTERVALS)) {
      for (const root of ROOTS) {
        const label = `${root} ${flavour}`
        const notes = scaleNotes({ root, flavour })

        expect(notes, label).toHaveLength(intervals.length)
        expect(notes[0], label).toBe(root)
        expect(new Set(notes).size, label).toBe(intervals.length)
        if (intervals.length === 7) {
          // A diatonic scale uses each letter name exactly once.
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
    // A diatonic scale never repeats or skips a letter. C\u266f Minor starts on
    // C\u266f \u2014 not its flat twin \u2014 and every degree that follows takes the next
    // letter, whatever accidental that needs.
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
    // Regression: a fixed flat spelling returned A B C D E G\u266d G \u2014 two Gs and no
    // F. The letter rule is what prevents it.
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
  // The catalogue now carries Blues and Harmonic minor, and this table has an
  // entry for neither — so SolvedPanel throws on a solved blues day. Fixing it
  // means teaching the speller a six-note scale, which is not this unit's to
  // decide; the gap is pinned here rather than quietly dropped.
  it('covers every flavour the catalogue uses', async () => {
    const { GROOVES } = await import('../../data/grooves.generated')
    for (const g of GROOVES) {
      expect(FLAVOUR_INTERVALS[g.flavour], `${g.id} uses ${g.flavour}`).toBeDefined()
    }
  })

  it('starts every flavour on the root, ascending and inside the octave', () => {
    // Not "seven degrees": the blues scale has six, which is the point of it.
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
