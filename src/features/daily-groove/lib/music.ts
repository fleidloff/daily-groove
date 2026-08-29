import type { Answer, Flavour, Groove, Root } from '../types'
import { buildOptions } from './options'
import { GROOVES } from './grooves.generated'
import { isoDate } from './selectGroove'

/** All twelve chromatic roots, in the design's order. */
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

/**
 * A groove's answer, read from the fields the generator wrote next to the
 * audio. Never parsed back out of `scale`: that string is for display, and a
 * two-word flavour (`harmonic minor`) has no unambiguous split.
 */
export function answerOf(groove: Groove): Answer {
  return { root: groove.root, flavour: groove.flavour }
}

/**
 * The set of flavours the given grooves actually carry, deduped and sorted for
 * stability. Deriving it from the catalogue means adding a groove with a new
 * flavour widens the pool with no other edit.
 */
export function flavourPool(grooves: Groove[]): Flavour[] {
  return Array.from(new Set(grooves.map((g) => g.flavour))).sort()
}

/**
 * The day's four flavour options: the groove's own flavour plus deterministic
 * distractors from the catalogue's pool, seeded by the ISO date so every player
 * sees the same four, in the same order, all day.
 */
export function flavourOptions(date: Date, groove: Groove): Flavour[] {
  return buildOptions(groove.flavour, flavourPool(GROOVES), isoDate(date))
}
