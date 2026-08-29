import { describe, expect, it } from 'vitest'
import { FLAVOUR_INTERVALS, UnknownFlavourError, scaleNotes } from './notes'
import { ROOTS, parseScale } from './music'
import { GROOVES } from './seed'

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
    // The real invariant. The earlier premise — that a flavour is spelled
    // wholly in flats or wholly in sharps — is what produced A B C D E G\u266d G,
    // and it is false for any scale whose degrees straddle the letter cycle.
    for (const root of ROOTS) {
      for (const flavour of Object.keys(FLAVOUR_INTERVALS)) {
        const notes = scaleNotes({ root, flavour })
        const letters = notes.map((n) => n[0])
        expect(new Set(letters).size, `${root} ${flavour}`).toBe(7)
        expect(notes[0], `${root} ${flavour}`).toBe(root)
      }
    }
  })

  it('gives the seeded natural-root scales their conventional accidentals', () => {
    // The old premise held for these by coincidence; keep it asserted where it
    // is actually true, so a regression in the common case still fails.
    expect(scaleNotes({ root: 'C', flavour: 'Minor' })).toEqual([
      'C', 'D', 'E\u266d', 'F', 'G', 'A\u266d', 'B\u266d',
    ])
    expect(scaleNotes({ root: 'D', flavour: 'Major' })).toEqual([
      'D', 'E', 'F\u266f', 'G', 'A', 'B', 'C\u266f',
    ])
    expect(scaleNotes({ root: 'F', flavour: 'Lydian' })).toEqual([
      'F', 'G', 'A', 'B', 'C', 'D', 'E',
    ])
  })

  it('spells the answer for every groove in the seed set', () => {
    for (const groove of GROOVES) {
      const answer = parseScale(groove.scale)
      const notes = scaleNotes(answer)

      expect(notes, groove.scale).toHaveLength(7)
      for (const note of notes) {
        expect(note.length, groove.scale).toBeGreaterThan(0)
      }
      expect(notes[0], groove.scale).toBe(answer.root)
      expect(new Set(notes).size, groove.scale).toBe(7)
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
      const notes = scaleNotes({ root, flavour: 'Minor' })
      expect(notes, root).toHaveLength(7)
      expect(new Set(notes).size, root).toBe(7)
    }
  })

  it('keeps the root as given and spells one letter per degree', () => {
    // A diatonic scale never repeats or skips a letter. C\u266f Minor starts on
    // C\u266f \u2014 not its flat twin \u2014 and every degree that follows takes the next
    // letter, whatever accidental that needs.
    expect(scaleNotes({ root: 'C\u266f', flavour: 'Minor' })).toEqual([
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

  it('uses each letter name exactly once for every seeded scale', () => {
    for (const groove of GROOVES) {
      const notes = scaleNotes(parseScale(groove.scale))
      const letters = notes.map((n) => n[0])
      expect(new Set(letters).size, groove.scale).toBe(7)
    }
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
  it('covers every flavour the seed set uses', () => {
    for (const groove of GROOVES) {
      const { flavour } = parseScale(groove.scale)
      expect(FLAVOUR_INTERVALS[flavour], flavour).toBeDefined()
    }
  })

  it('gives every flavour seven degrees starting at the root', () => {
    for (const [flavour, intervals] of Object.entries(FLAVOUR_INTERVALS)) {
      expect(intervals, flavour).toHaveLength(7)
      expect(intervals[0], flavour).toBe(0)
    }
  })
})
