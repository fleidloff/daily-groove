import { describe, it, expect } from 'vitest'
import type { Flavour } from '../groove'
import type { LickNote } from './licks'
import { LICKS, LICK_VARIATIONS, lickFor } from './licks'
import { degreeSemitones } from './phrase'
import { FLAVOUR_INTERVALS } from './scales'
import { FLAVOURS, displayFlavour } from './names'

const POOL = FLAVOURS.map(displayFlavour).sort()

const SIGNATURE: Record<Flavour, { present: number[] }> = {
  Ionian: { present: [2, 3, 5, 6] },
  Dorian: { present: [2, 5] },
  Phrygian: { present: [1] },
  Lydian: { present: [3] },
  Mixolydian: { present: [2, 5, 6] },
  Aeolian: { present: [1, 2, 5, 6] },
  Blues: { present: [3] },
  'Harmonic minor': { present: [5, 6] },
  'Melodic minor': { present: [5, 6] },
  'Harmonic major': { present: [2, 5, 6] },
  'Lydian dominant': { present: [3, 6] },
  'Phrygian dominant': { present: [1, 2] },
}

const ALL: [string, LickNote[]][] = Object.entries(LICKS).flatMap(([flavour, variations]) =>
  variations.map((notes, i): [string, LickNote[]] => [`${flavour} v${i + 1}`, notes]),
)

describe('LICKS', () => {
  it('carries three phrases for every mode the catalogue can play', () => {
    for (const flavour of POOL) {
      for (let v = 0; v < LICK_VARIATIONS; v += 1) {
        expect(lickFor(flavour, v), `${flavour} v${v}`).not.toBeNull()
      }
      expect(LICKS[flavour], flavour).toHaveLength(LICK_VARIATIONS)
    }
    expect(Object.keys(LICKS).sort()).toEqual([...POOL].sort())
  })

  it('is a phrase of about one bar, not a scale run', () => {
    for (const [flavour, notes] of ALL) {
      expect(notes.length, flavour).toBeGreaterThanOrEqual(4)
      expect(notes.length, flavour).toBeLessThanOrEqual(12)
      expect(notes[0].beat, flavour).toBe(0)
      for (let i = 0; i < notes.length; i += 1) {
        expect(notes[i].beats, `${flavour} note ${i}`).toBeGreaterThan(0)
        if (i > 0) {
          expect(notes[i].beat, `${flavour} note ${i}`).toBeGreaterThan(notes[i - 1].beat)
        }
      }
      const last = notes[notes.length - 1]
      expect(last.beat + last.beats, flavour).toBeLessThanOrEqual(4.5)
      for (const note of notes) {
        expect(note.beats, `${flavour} holds a note past the sample`).toBeLessThanOrEqual(2)
      }
    }
  })

  it.each(Object.keys(SIGNATURE))('leans on what makes %s that mode', (flavour) => {
    for (let v = 0; v < LICK_VARIATIONS; v += 1) {
      const notes = lickFor(flavour, v)
      expect(notes, `${flavour} v${v}`).not.toBeNull()
      const degrees = (notes ?? []).map((n) => n.degree)
      for (const degree of SIGNATURE[flavour].present) {
        expect(degrees, `${flavour} v${v} must sound degree ${degree}`).toContain(degree)
      }
    }
  })

  it('sounds a set of pitches no other scale can hold', () => {
    const scales = Object.entries(FLAVOUR_INTERVALS).map(([name, intervals]) => ({
      name,
      pitchClasses: new Set(intervals.map((semitones) => ((semitones % 12) + 12) % 12)),
    }))

    for (const [label, notes] of ALL) {
      const flavour = label.slice(0, -3)
      const sounded = new Set(
        notes.map((n) => ((degreeSemitones(flavour, n.degree) % 12) + 12) % 12),
      )
      const fits = scales
        .filter((scale) => [...sounded].every((pc) => scale.pitchClasses.has(pc)))
        .map((scale) => scale.name)
      expect(fits, `${label} also fits ${fits.join(', ')}`).toEqual([flavour])
    }
  })

  it('repeats neither a pitch sequence nor a rhythm, across all thirty-six', () => {
    const pitches = ALL.map(([, notes]) => JSON.stringify(notes.map((n) => n.degree)))
    const rhythms = ALL.map(([, notes]) => JSON.stringify(notes.map((n) => [n.beat, n.beats])))
    expect(ALL).toHaveLength(POOL.length * LICK_VARIATIONS)
    expect(new Set(pitches).size).toBe(ALL.length)
    expect(new Set(rhythms).size).toBe(ALL.length)
  })
})

describe('lickFor', () => {
  it('reads a mode however it is cased', () => {
    expect(lickFor('lydian')).toEqual(LICKS.Lydian[0])
    expect(lickFor('HARMONIC MINOR')).toEqual(LICKS['Harmonic minor'][0])
  })

  it('hands back the variation it is asked for, and wraps past the last', () => {
    expect(lickFor('Dorian', 1)).toEqual(LICKS.Dorian[1])
    expect(lickFor('Dorian', 2)).toEqual(LICKS.Dorian[2])
    expect(lickFor('Dorian', 3)).toEqual(LICKS.Dorian[0])
    expect(lickFor('Dorian', -1)).toEqual(LICKS.Dorian[2])
  })

  it('is the first variation when none is asked for', () => {
    expect(lickFor('Blues')).toEqual(LICKS.Blues[0])
  })

  it('is silence, not a throw, for a mode it has never heard of', () => {
    expect(lickFor('Locrian', 2)).toBeNull()
    expect(lickFor('Locrian')).toBeNull()
    expect(lickFor('Whole tone')).toBeNull()
    expect(lickFor('')).toBeNull()
  })
})
