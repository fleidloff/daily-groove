import type { Root } from '../../../src/lib/groove.ts'
import type { Flavour } from '../types.ts'
import { pitchClassOf } from './notes.ts'

/**
 * The twelve flavours the game offers, in the order the app's answer options
 * present them. A template's `flavours` is a subset of this list.
 *
 * The order is load-bearing: a seed's flavour draw indexes into it, so a
 * reordered list renders different audio for an unchanged catalogue entry. The
 * four Epic 6 added are therefore appended, never interleaved.
 *
 * Every entry has a perfect fifth. That is not a coincidence but the gate a
 * candidate mode has to clear: without it `chordsForScale` finds no quality in
 * `QUALITIES` the scale entirely contains, so `buildHarmony` throws and the
 * groove cannot state its own harmony — and the app's `familyOf` has no honest
 * third to grade it by. Locrian and the symmetric scales fail exactly there,
 * which is why they are absent.
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
  'melodic-minor',
  'lydian-dominant',
  'phrygian-dominant',
  'harmonic-major',
]

/**
 * Semitone offsets from the root, ascending, one entry per flavour. Seven-note
 * modes plus the six-note blues scale, which is deliberately not a mode: it is
 * the minor pentatonic with the ♭5 passing tone, and the harmony module has to
 * cope with it having one fewer degree.
 *
 * Each of the four Epic 6 added is annotated with the interval that grades it —
 * the third, which decides its family — and the interval it is recognised by.
 * The split is deliberate: the original eight are three major-third and five
 * minor-third, so three major and one minor bring the twelve to six and six.
 * An uneven set would make one of simple mode's two answers the better blind
 * guess, which is precisely the elimination strategy the wider pool exists to
 * defeat.
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
  /** Minor third (3); the natural 6 and raised 7 over it — tonic mMaj7. */
  'melodic-minor': [0, 2, 3, 5, 7, 9, 11],
  /** Major third (4); the ♯4 (6) beside a ♭7 (10) — tonic 7. */
  'lydian-dominant': [0, 2, 4, 6, 7, 9, 10],
  /** Major third (4); the ♭2 (1) over it — tonic 7. */
  'phrygian-dominant': [0, 1, 4, 5, 7, 8, 10],
  /** Major third (4); ionian with a ♭6 (8) — tonic maj7. */
  'harmonic-major': [0, 2, 4, 5, 7, 8, 11],
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
