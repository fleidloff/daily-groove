import { describe, expect, it } from 'vitest'
import { STAFF_FLOOR_STEP, UnknownNoteError, staffNotes } from './staff'
import { scaleNotes } from './notes'
import { scaleDegrees } from './degrees'
import { ROOTS } from './roots'
import { FLAVOUR_INTERVALS } from './scales'
import type { Flavour, Root } from '../groove'

const FLAVOURS = Object.keys(FLAVOUR_INTERVALS)

const steps = (root: Root, flavour: Flavour) =>
  staffNotes(scaleNotes({ root, flavour })).map((n) => n.step)

describe('staffNotes', () => {
  it('puts a natural scale from C on consecutive steps with no accidentals', () => {
    const notes = staffNotes(['C', 'D', 'E', 'F', 'G', 'A', 'B'])

    expect(notes.map((n) => n.step)).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect(notes.map((n) => n.accidental)).toEqual(['', '', '', '', '', '', ''])
  })

  it('carries the accidental beside the position, not in it', () => {
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
    expect(notes[notes.length - 1].step).toBe(12)
  })

  it('keeps the blues scale two notes on one line, the second marked natural', () => {
    const notes = staffNotes(scaleNotes({ root: 'C', flavour: 'Blues' }))

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
    expect(staffNotes(['C', 'G']).map((n) => n.accidental)).toEqual(['', ''])
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

    expect(pairs).toBe(ROOTS.length * FLAVOURS.length)
    expect(pairs).toBeGreaterThan(0)
    expect(reachedTheFloor, 'no pair reaches the floor').toBe(true)
  })
})

describe('a degree list beside its note list', () => {
  it('is always exactly as long as the notes it names', () => {
    for (const root of ROOTS) {
      for (const flavour of FLAVOURS) {
        const label = `${root} ${flavour}`

        expect(scaleDegrees({ root, flavour }).length, label).toBe(
          staffNotes(scaleNotes({ root, flavour })).length,
        )
      }
    }

    expect(scaleDegrees({ root: 'C', flavour: 'Blues' })).toHaveLength(6)
    expect(scaleDegrees({ root: 'C', flavour: 'Mixolydian' })).toHaveLength(7)
  })
})
