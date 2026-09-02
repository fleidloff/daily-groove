import { describe, it, expect } from 'vitest'
import type { Flavour } from '../../types'
import { LICKS, lickFor } from './licks'
import { degreeSemitones } from './phrase'
import { FLAVOUR_INTERVALS } from './notes'
import { flavourPool } from './music'
import { GROOVES } from '../../data/grooves.generated'

/**
 * The pool is derived from the shipped manifest rather than hardcoded, the same
 * tripwire `families.test.ts` uses: a hardcoded list stays green on exactly the
 * day a thirteenth mode is minted, which is the day that mode's chip taps into
 * silence.
 */
const POOL = flavourPool(GROOVES)

/**
 * The interval each mode's phrase must lean on, as degree indices into that
 * mode's own table — so 3 is Lydian's ♯4 and 1 is Phrygian's ♭2 (R5, R6).
 *
 * Present only, never absent. A degree index resolves through the tapped mode's
 * own interval table, so the *same* index is a different pitch in a different
 * mode and a degree a phrase does not sound distinguishes nothing: Dorian and
 * Aeolian differ only at index 5, and index 2 is three semitones in both. Worse
 * than useless, in fact — withholding a pitch class can only widen the set of
 * scales a phrase fits, so an `absent` entry works against the one property
 * that matters. The field is left out of the type rather than left unused,
 * because an unused field is an invitation.
 *
 * What `absent` was reaching for is the containment case below, which asks the
 * question directly: does this phrase fit any scale but its own?
 */
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
  // AC4: every mode the row can offer has something to say.
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
      // A note file is 2.0 s and the voice ramps it to zero at
      // `durationSeconds + 0.03`. The slowest tempo any template can draw is
      // open-ballad's 62 bpm, where two beats is 1.935 s and the ramp ends at
      // 1.965 s — 35 ms of file left. 2.25 beats overruns it, and the failure
      // is a note that goes quiet early at ballad tempo and nowhere else.
      for (const note of notes) {
        expect(note.beats, `${flavour} holds a note past the sample`).toBeLessThanOrEqual(2)
      }
    }
  })

  // R5, R6: each phrase leans on the interval that tells its mode from its
  // neighbours, rather than being the same shape in a different scale.
  it.each(Object.keys(SIGNATURE))('leans on what makes %s that mode', (flavour) => {
    const notes = lickFor(flavour)
    expect(notes, flavour).not.toBeNull()
    const degrees = (notes ?? []).map((n) => n.degree)
    for (const degree of SIGNATURE[flavour].present) {
      expect(degrees, `${flavour} must sound degree ${degree}`).toContain(degree)
    }
  })

  /**
   * R6, and the case `absent` was reaching for: a phrase must fit its own scale
   * and no other. Measured in the pitches the app actually schedules —
   * `degreeSemitones` is what `scheduleLick` resolves through — against every
   * entry in `FLAVOUR_INTERVALS`, Locrian included, not merely the twelve the
   * catalogue mints today.
   *
   * The bug this exists to catch is not hypothetical: a Dorian phrase written
   * without its third was note-for-note a legal Mixolydian one, and Mixolydian
   * can be the chip sitting next to it on the row.
   */
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

  // AC6c, both halves: R5a says the rhythms differ, R5b says the pitches
  // differ on their own, so a player separating two modes has learned the mode
  // and not the pattern.
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

  // R19, R20: reached from a click handler after the selection has happened, so
  // a mode with no phrase is silence rather than a throw.
  it('is silence, not a throw, for a mode it has never heard of', () => {
    expect(lickFor('Locrian')).toBeNull()
    expect(lickFor('Whole tone')).toBeNull()
    expect(lickFor('')).toBeNull()
  })
})
