import { describe, it, expect } from 'vitest'
import {
  HIGHEST_MIDI,
  LOWEST_MIDI,
  degreeSemitones,
  rootMidiOf,
  scheduleLick,
} from './phrase'
import { LICKS } from './licks'
import { ROOTS, flavourPool } from './music'
import { UnknownFlavourError, UnknownRootError } from './notes'
import { GROOVES } from '../../data/grooves.generated'

const POOL = flavourPool(GROOVES)

describe('rootMidiOf', () => {
  // R1: every lick is rooted on the day's root, in the octave the reference
  // notes already occupy, so C4 is the floor and B4 the ceiling.
  it('puts a root in the reference octave', () => {
    expect(rootMidiOf('C')).toBe(60)
    expect(rootMidiOf('E♭')).toBe(63)
    expect(rootMidiOf('B')).toBe(71)
  })

  it('covers the twelve roots with the twelve chromatic pitches', () => {
    expect(ROOTS.map(rootMidiOf)).toEqual([60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71])
    expect(LOWEST_MIDI).toBe(60)
    expect(HIGHEST_MIDI).toBe(83)
  })

  it('throws for anything that is not a chromatic root', () => {
    expect(() => rootMidiOf('H' as never)).toThrow(UnknownRootError)
  })
})

describe('degreeSemitones', () => {
  // R5, R6: the degree is an index into the mode's own table, which is what
  // makes one written phrase sound different in each of the twelve.
  it('resolves a degree through the mode that is playing', () => {
    expect(degreeSemitones('Lydian', 3)).toBe(6)
    expect(degreeSemitones('Ionian', 3)).toBe(5)
    expect(degreeSemitones('Phrygian', 1)).toBe(1)
    expect(degreeSemitones('Aeolian', 1)).toBe(2)
    expect(degreeSemitones('Dorian', 5)).toBe(9)
    expect(degreeSemitones('Aeolian', 5)).toBe(8)
  })

  it('wraps into the octave above, whatever the scale length', () => {
    expect(degreeSemitones('Ionian', 7)).toBe(12)
    expect(degreeSemitones('Blues', 6)).toBe(12)
    expect(degreeSemitones('Blues', 3)).toBe(6)
  })

  it('reads a mode however it is cased, and throws for one with no table', () => {
    expect(degreeSemitones('lydian', 3)).toBe(6)
    expect(() => degreeSemitones('Whole tone', 0)).toThrow(UnknownFlavourError)
  })
})

describe('scheduleLick', () => {
  // AC5, AC10: the phrase as written, resolved against one root and one tempo.
  it('turns a lick, a root and a tempo into the notes to schedule', () => {
    const notes = scheduleLick({ flavour: 'Lydian', root: 'C', bpm: 120 })
    expect(notes).toHaveLength(LICKS.Lydian.length)
    expect(notes[0].offsetSeconds).toBe(0)
    notes.forEach((note, i) => {
      const written = LICKS.Lydian[i]
      expect(note.midi).toBe(60 + degreeSemitones('Lydian', written.degree))
      expect(note.offsetSeconds).toBeCloseTo(written.beat * 0.5, 12)
      expect(note.durationSeconds).toBeCloseTo(written.beats * 0.5, 12)
    })
  })

  // AC10: the same phrase at the catalogue's slowest and fastest tempo — same
  // pitches, times in proportion.
  it.each(POOL)('scales %s with the tempo, pitch for pitch', (flavour) => {
    const slow = scheduleLick({ flavour, root: 'F', bpm: 67 })
    const fast = scheduleLick({ flavour, root: 'F', bpm: 130 })
    expect(slow.map((n) => n.midi)).toEqual(fast.map((n) => n.midi))
    const ratio = 130 / 67
    slow.forEach((note, i) => {
      expect(note.offsetSeconds).toBeCloseTo(fast[i].offsetSeconds * ratio, 9)
      expect(note.durationSeconds).toBeCloseTo(fast[i].durationSeconds * ratio, 9)
    })
  })

  // R26: the render provides C4–B5 and nothing else, so a phrase that reaches
  // past it is a phrase with no file behind it.
  it('stays inside the rendered range, from every root', () => {
    for (const flavour of POOL) {
      for (const root of ROOTS) {
        for (const note of scheduleLick({ flavour, root, bpm: 100 })) {
          expect(note.midi, `${flavour} on ${root}`).toBeGreaterThanOrEqual(LOWEST_MIDI)
          expect(note.midi, `${flavour} on ${root}`).toBeLessThanOrEqual(HIGHEST_MIDI)
        }
      }
    }
  })

  // AC5: from one root, no two modes produce the same pitches.
  it('gives twelve different sequences of pitches from one root', () => {
    const sequences = POOL.map((flavour) =>
      JSON.stringify(scheduleLick({ flavour, root: 'C', bpm: 100 }).map((n) => n.midi)),
    )
    expect(sequences).toHaveLength(12)
    expect(new Set(sequences).size).toBe(12)
  })

  // R20: a mode with no phrase, and a tempo that makes no sense, are both
  // silence — this is reached from a click handler.
  it('is silence, not a throw, when there is nothing to play', () => {
    expect(scheduleLick({ flavour: 'Locrian', root: 'C', bpm: 100 })).toEqual([])
    expect(scheduleLick({ flavour: 'Lydian', root: 'C', bpm: 0 })).toEqual([])
    expect(scheduleLick({ flavour: 'Lydian', root: 'C', bpm: Number.NaN })).toEqual([])
    expect(scheduleLick({ flavour: 'Lydian', root: 'C', bpm: -120 })).toEqual([])
  })
})
