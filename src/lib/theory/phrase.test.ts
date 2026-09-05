import { describe, it, expect } from 'vitest'
import {
  HIGHEST_MIDI,
  LOWEST_MIDI,
  degreeSemitones,
  rootMidiOf,
  scheduleLick,
} from './phrase'
import { LICKS, LICK_VARIATIONS } from './licks'
import { ROOTS } from './roots'
import { FLAVOURS, displayFlavour } from './names'
import { UnknownFlavourError, UnknownRootError } from './notes'

const POOL = FLAVOURS.map(displayFlavour).sort()

describe('rootMidiOf', () => {
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
  it('turns a lick, a root and a tempo into the notes to schedule', () => {
    const notes = scheduleLick({ flavour: 'Lydian', root: 'C', bpm: 120 })
    expect(notes).toHaveLength(LICKS.Lydian[0].length)
    expect(notes[0].offsetSeconds).toBe(0)
    notes.forEach((note, i) => {
      const written = LICKS.Lydian[0][i]
      expect(note.midi).toBe(60 + degreeSemitones('Lydian', written.degree))
      expect(note.offsetSeconds).toBeCloseTo(written.beat * 0.5, 12)
      expect(note.durationSeconds).toBeCloseTo(written.beats * 0.5, 12)
    })
  })

  it.each(POOL)('scales %s with the tempo, pitch for pitch', (flavour) => {
    const slow = scheduleLick({ flavour, root: 'F', bpm: 67, variation: 2 })
    const fast = scheduleLick({ flavour, root: 'F', bpm: 130, variation: 2 })
    expect(slow.map((n) => n.midi)).toEqual(fast.map((n) => n.midi))
    const ratio = 130 / 67
    slow.forEach((note, i) => {
      expect(note.offsetSeconds).toBeCloseTo(fast[i].offsetSeconds * ratio, 9)
      expect(note.durationSeconds).toBeCloseTo(fast[i].durationSeconds * ratio, 9)
    })
  })

  it('stays inside the rendered range, from every root and every variation', () => {
    for (const flavour of POOL) {
      for (const root of ROOTS) {
        for (let v = 0; v < LICK_VARIATIONS; v += 1) {
          for (const note of scheduleLick({ flavour, root, bpm: 100, variation: v })) {
            expect(note.midi, `${flavour} v${v} on ${root}`).toBeGreaterThanOrEqual(LOWEST_MIDI)
            expect(note.midi, `${flavour} v${v} on ${root}`).toBeLessThanOrEqual(HIGHEST_MIDI)
          }
        }
      }
    }
  })

  it('plays the variation it is handed, and the first when it is handed none', () => {
    const first = scheduleLick({ flavour: 'Dorian', root: 'C', bpm: 100 })
    const second = scheduleLick({ flavour: 'Dorian', root: 'C', bpm: 100, variation: 1 })
    const third = scheduleLick({ flavour: 'Dorian', root: 'C', bpm: 100, variation: 2 })
    expect(first).toEqual(scheduleLick({ flavour: 'Dorian', root: 'C', bpm: 100, variation: 0 }))
    const shapes = [first, second, third].map((notes) =>
      JSON.stringify(notes.map((n) => [n.midi, n.offsetSeconds])),
    )
    expect(new Set(shapes).size).toBe(LICK_VARIATIONS)
  })

  it('gives twelve different sequences of pitches from one root, in every variation', () => {
    for (let v = 0; v < LICK_VARIATIONS; v += 1) {
      const sequences = POOL.map((flavour) =>
        JSON.stringify(
          scheduleLick({ flavour, root: 'C', bpm: 100, variation: v }).map((n) => n.midi),
        ),
      )
      expect(new Set(sequences).size, `variation ${v}`).toBe(12)
    }
  })

  it('gives twelve different sequences of pitches from one root', () => {
    const sequences = POOL.map((flavour) =>
      JSON.stringify(scheduleLick({ flavour, root: 'C', bpm: 100 }).map((n) => n.midi)),
    )
    expect(sequences).toHaveLength(12)
    expect(new Set(sequences).size).toBe(12)
  })

  it('is silence, not a throw, when there is nothing to play', () => {
    expect(scheduleLick({ flavour: 'Locrian', root: 'C', bpm: 100 })).toEqual([])
    expect(scheduleLick({ flavour: 'Lydian', root: 'C', bpm: 0 })).toEqual([])
    expect(scheduleLick({ flavour: 'Lydian', root: 'C', bpm: Number.NaN })).toEqual([])
    expect(scheduleLick({ flavour: 'Lydian', root: 'C', bpm: -120 })).toEqual([])
  })
})
