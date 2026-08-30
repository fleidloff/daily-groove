import type { Root } from '../../../src/lib/groove.ts'
import type { Flavour } from '../types.ts'
import { pitchClassOf } from './notes.ts'

/**
 * The eight flavours the game offers, in the order the app's answer options
 * present them. A template's `flavours` is a subset of this list.
 */
export const FLAVOURS: Flavour[] = [
  'ionian',
  'aeolian',
  'dorian',
  'mixolydian',
  'lydian',
  'phrygian',
  'harmonic-minor',
  'blues',
]

/**
 * Semitone offsets from the root, ascending, one entry per flavour. Seven-note
 * modes plus the six-note blues scale, which is deliberately not a mode: it is
 * the minor pentatonic with the ♭5 passing tone, and the harmony module has to
 * cope with it having one fewer degree.
 */
export const INTERVALS: Record<Flavour, number[]> = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  blues: [0, 3, 5, 6, 7, 10],
}

/** The interval set for a flavour. Throws rather than returning undefined. */
export function intervalsFor(flavour: Flavour): number[] {
  const intervals = INTERVALS[flavour]
  if (!intervals) {
    throw new Error(`intervalsFor: unknown flavour "${flavour}"`)
  }
  return intervals
}

/**
 * The display name of a scale, e.g. "C dorian". The internal flavour id is
 * hyphenated where the display is two words, so 'harmonic-minor' reads as
 * "harmonic minor".
 */
export function scaleName(root: Root, flavour: Flavour): string {
  return `${root} ${flavour.replace(/-/g, ' ')}`
}

/**
 * The scale's pitch classes (0..11), ascending from the root's own class and
 * then wrapped, so membership tests are a simple `includes` on `midi % 12`.
 */
export function pitchesOf(root: Root, flavour: Flavour): number[] {
  const base = pitchClassOf(root)
  return intervalsFor(flavour)
    .map((interval) => (base + interval) % 12)
    .sort((a, b) => a - b)
}
