import type { Root } from '../types.ts'

/**
 * The twelve chromatic roots, in the app's spelling and order. Index is the
 * pitch class, so ROOTS[0] is C and ROOTS[11] is B. Sharps and flats are the
 * Unicode accidentals (U+266F, U+266D) the app's `Root` type uses, so no layer
 * between here and the manifest has to translate spellings.
 */
export const ROOTS: Root[] = [
  'C',
  'C♯',
  'D',
  'E♭',
  'E',
  'F',
  'F♯',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
]

/** The 0..11 pitch class of a root. C is 0. */
export function pitchClassOf(root: Root): number {
  const index = ROOTS.indexOf(root)
  if (index < 0) {
    throw new Error(`pitchClassOf: unknown root "${root}"`)
  }
  return index
}

/** MIDI number for a root in a given octave, scientific pitch: C4 is 60. */
export function midiOf(root: Root, octave: number): number {
  return (octave + 1) * 12 + pitchClassOf(root)
}

/** The root name of a MIDI number, discarding its octave. */
export function noteName(midi: number): Root {
  const pc = ((Math.round(midi) % 12) + 12) % 12
  return ROOTS[pc]
}
