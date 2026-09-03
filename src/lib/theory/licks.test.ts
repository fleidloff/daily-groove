import { describe, it, expect } from 'vitest'
import type { Flavour } from '../groove'
import { LICKS, lickFor } from './licks'
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

describe('LICKS', () => {
  it('carries one phrase for every mode the catalogue can play', () => {
    for (const flavour of POOL) {
      expect(lickFor(flavour), flavour).not.toBeNull()
    }
    expect(Object.keys(LICKS).sort()).toEqual([...POOL].sort())
  })

  it('is a phrase of about one bar, not a scale run', () => {
    for (const [flavour, notes] of Object.entries(LICKS)) {
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
    const notes = lickFor(flavour)
    expect(notes, flavour).not.toBeNull()
    const degrees = (notes ?? []).map((n) => n.degree)
    for (const degree of SIGNATURE[flavour].present) {
      expect(degrees, `${flavour} must sound degree ${degree}`).toContain(degree)
    }
  })

  it('sounds a set of pitches no other scale can hold', () => {
    const scales = Object.entries(FLAVOUR_INTERVALS).map(([name, intervals]) => ({
      name,
      pitchClasses: new Set(intervals.map((semitones) => ((semitones % 12) + 12) % 12)),
    }))

    for (const [flavour, notes] of Object.entries(LICKS)) {
      const sounded = new Set(
        notes.map((n) => ((degreeSemitones(flavour, n.degree) % 12) + 12) % 12),
      )
      const fits = scales
        .filter((scale) => [...sounded].every((pc) => scale.pitchClasses.has(pc)))
        .map((scale) => scale.name)
      expect(fits, `${flavour} also fits ${fits.join(', ')}`).toEqual([flavour])
    }
  })

  it('repeats neither a pitch sequence nor a rhythm', () => {
    const entries = Object.entries(LICKS)
    const pitches = entries.map(([, notes]) => JSON.stringify(notes.map((n) => n.degree)))
    const rhythms = entries.map(([, notes]) =>
      JSON.stringify(notes.map((n) => [n.beat, n.beats])),
    )
    expect(new Set(pitches).size).toBe(entries.length)
    expect(new Set(rhythms).size).toBe(entries.length)
  })
})

describe('lickFor', () => {
  it('reads a mode however it is cased', () => {
    expect(lickFor('lydian')).toEqual(LICKS.Lydian)
    expect(lickFor('HARMONIC MINOR')).toEqual(LICKS['Harmonic minor'])
  })

  it('is silence, not a throw, for a mode it has never heard of', () => {
    expect(lickFor('Locrian')).toBeNull()
    expect(lickFor('Whole tone')).toBeNull()
    expect(lickFor('')).toBeNull()
  })
})
