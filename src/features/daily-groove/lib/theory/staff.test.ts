import { describe, expect, it } from 'vitest'
import { STAFF_FLOOR_STEP, UnknownNoteError, staffNotes } from './staff'
import { FLAVOUR_INTERVALS, scaleNotes } from './notes'
import { scaleDegrees } from './degrees'
import { ROOTS } from './music'
import { GROOVES } from '../../data/grooves.generated'
import type { Flavour, Root } from '../../types'

/** Every flavour the catalogue can mint, in the interval table's own order. */
const FLAVOURS = Object.keys(FLAVOUR_INTERVALS)

/**
 * The staff steps one root × flavour pair puts on the page. Both the cross
 * product and the manifest tripwire below measure the floor through this.
 */
const steps = (root: Root, flavour: Flavour) =>
  staffNotes(scaleNotes({ root, flavour })).map((n) => n.step)

describe('staffNotes', () => {
  it('puts a natural scale from C on consecutive steps with no accidentals', () => {
    const notes = staffNotes(['C', 'D', 'E', 'F', 'G', 'A', 'B'])

    expect(notes.map((n) => n.step)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(notes.map((n) => n.accidental)).toEqual(['', '', '', '', '', '', ''])
  })

  it('carries the accidental beside the position, not in it', () => {
    // E Dorian. The C♯ is step 7 — an octave above the C that would be step 0 —
    // because the letters have wrapped past B.
    const notes = staffNotes(['E', 'F♯', 'G', 'A', 'B', 'C♯', 'D'])

    expect(notes.map((n) => n.step)).toEqual([2, 3, 4, 5, 6, 7, 8])
    expect(notes.map((n) => n.accidental)).toEqual([
      '',
      '♯',
      '',
      '',
      '',
      '♯',
      '',
    ])
  })

  it('gives a flattened note the same step as its natural letter', () => {
    // E♭ and E share a line and differ only by the glyph in front.
    expect(staffNotes(['E♭'])[0]).toEqual({ step: 2, accidental: '♭' })
    expect(staffNotes(['E'])[0]).toEqual({ step: 2, accidental: '' })
  })

  it('places the root in the octave running upward from middle C', () => {
    const firstStep = (root: Root) =>
      staffNotes(scaleNotes({ root, flavour: 'Ionian' }))[0].step

    expect(firstStep('C')).toBe(0)
    expect(firstStep('E')).toBe(2)
    expect(firstStep('B')).toBe(6)
  })

  it('lets a scale from B run off the top of the staff rather than re-centring it', () => {
    const notes = staffNotes(scaleNotes({ root: 'B', flavour: 'Ionian' }))

    expect(notes[0].step).toBe(6)
    // Seven ascending letters from step 6 end at step 12 — above the treble
    // staff's top line (F5, step 10), which is where the ledger lines come in.
    expect(notes[notes.length - 1].step).toBe(12)
  })

  it('keeps the blues scale two notes on one line, the second marked natural', () => {
    const notes = staffNotes(scaleNotes({ root: 'C', flavour: 'Blues' }))

    // C E♭ F G♭ G B♭ — six notes, and the G♭ and G share a letter.
    expect(notes).toHaveLength(6)
    expect(notes[3].step).toBe(notes[4].step)
    expect(notes[3].accidental).toBe('♭')
    expect(notes[4].accidental).toBe('♮')
    expect(notes.map((n) => n.step)).toEqual([0, 2, 3, 4, 4, 6])
    expect(notes.map((n) => n.accidental)).toEqual([
      '',
      '♭',
      '',
      '♭',
      '♮',
      '♭',
    ])
  })

  it('does not mark a note natural when nothing before it altered its line', () => {
    // No G♭ earlier in the array, so this G is just a G.
    expect(staffNotes(['C', 'G']).map((n) => n.accidental)).toEqual(['', ''])
    // A different octave is a different step, so it is a different line.
    expect(
      staffNotes(['G♭', 'A', 'B', 'C', 'D', 'E', 'F', 'G']).map(
        (n) => n.accidental,
      ),
    ).toEqual(['♭', '', '', '', '', '', '', ''])
  })

  it('maps every root against every flavour the catalogue can mint', () => {
    for (const root of ROOTS) {
      for (const flavour of Object.keys(FLAVOUR_INTERVALS)) {
        const label = `${root} ${flavour}`
        const names = scaleNotes({ root, flavour })

        const notes = staffNotes(names)

        expect(notes, label).toHaveLength(names.length)
        for (const note of notes) {
          expect(Number.isInteger(note.step), label).toBe(true)
          expect(
            ['', '♯', '♭', '♯♯', '♭♭', '♮'],
            `${label} — ${note.accidental}`,
          ).toContain(note.accidental)
        }

        const steps = notes.map((n) => n.step)
        // Ascending: never downward. Two notes share a step only where the
        // spelling shares a letter, which only the six-note blues scale does.
        for (let i = 1; i < steps.length; i += 1) {
          expect(steps[i], `${label} — step ${i}`).toBeGreaterThanOrEqual(
            steps[i - 1],
          )
        }
        const repeats = steps.length - new Set(steps).size
        expect(repeats, label).toBe(names.length === 7 ? 0 : 1)
      }
    }
  })

  it('spells the double accidentals notes.ts can produce', () => {
    expect(staffNotes(['F♯♯', 'B♭♭'])).toEqual([
      { step: 3, accidental: '♯♯' },
      { step: 6, accidental: '♭♭' },
    ])
  })

  it('throws a named error on a name it cannot parse', () => {
    expect(() => staffNotes(['H♭'])).toThrow(UnknownNoteError)
    expect(() => staffNotes(['C♯♭'])).toThrow(UnknownNoteError)
    expect(() => staffNotes(['C#'])).toThrow(UnknownNoteError)
    expect(() => staffNotes([''])).toThrow(UnknownNoteError)
    expect(() => staffNotes(['H♭'])).toThrow('H♭')
  })

  it('returns nothing for nothing', () => {
    expect(staffNotes([])).toEqual([])
  })
})

describe('STAFF_FLOOR_STEP', () => {
  // AC10: the degree row's y is derived from this one number, so the claim
  // "it clears every day's lowest notehead" has to be measured rather than
  // commented. The cross product is the whole point — a hardcoded list of
  // roots would stay green on exactly the day a groove is minted outside the
  // range it assumed.
  it('is the floor of every scale the app can spell', () => {
    let pairs = 0
    let reachedTheFloor = false

    for (const root of ROOTS) {
      for (const flavour of FLAVOURS) {
        const label = `${root} ${flavour}`

        expect(() => steps(root, flavour), label).not.toThrow()

        const lowest = Math.min(...steps(root, flavour))
        expect(lowest, label).toBeGreaterThanOrEqual(STAFF_FLOOR_STEP)
        if (lowest === STAFF_FLOOR_STEP) reachedTheFloor = true
        pairs += 1
      }
    }

    // The loop actually ran over the whole product, so a future shrink of
    // either list is a failure rather than a quietly smaller sweep.
    expect(pairs).toBe(ROOTS.length * FLAVOURS.length)
    expect(pairs).toBeGreaterThan(0)
    // Tight, not slack: some scale sits exactly on the floor (every C-rooted
    // one does), so the row is not placed further down than it needs to be.
    expect(reachedTheFloor, 'no pair reaches the floor').toBe(true)
  })

  // AC10, and the tripwire for the day the catalogue grows a scale that hangs
  // lower than the drawing's fixed row — which is the day a numeral would
  // start crossing a notehead.
  it('holds for every groove the shipped manifest can play', () => {
    expect(GROOVES.length).toBeGreaterThan(0)

    for (const groove of GROOVES) {
      const label = `${groove.id} — ${groove.root} ${groove.flavour}`
      const lowest = Math.min(...steps(groove.root, groove.flavour))

      expect(lowest, label).toBeGreaterThanOrEqual(STAFF_FLOOR_STEP)
    }
  })
})

describe('a degree list beside its note list', () => {
  // AC8: the drawing pairs degrees and notes by index and does not count, so
  // a disagreement between the two arrays has to be caught here, in lib/.
  it('is always exactly as long as the notes it names', () => {
    for (const root of ROOTS) {
      for (const flavour of FLAVOURS) {
        const label = `${root} ${flavour}`

        expect(scaleDegrees({ root, flavour }).length, label).toBe(
          staffNotes(scaleNotes({ root, flavour })).length,
        )
      }
    }

    // Named, so the counts are readable and not just equal to each other: the
    // blues scale is six notes, every mode is seven.
    expect(scaleDegrees({ root: 'C', flavour: 'Blues' })).toHaveLength(6)
    expect(scaleDegrees({ root: 'C', flavour: 'Mixolydian' })).toHaveLength(7)
  })
})
