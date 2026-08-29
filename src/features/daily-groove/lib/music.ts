import type { Answer, Flavour, Groove, Root } from '../types'
import { buildOptions } from './options'
import { GROOVES } from './seed'
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
 * Derive a groove's answer from its `scale` field — the single source of truth.
 * Splits on the FIRST space only, so a multi-word flavour ("harmonic minor")
 * survives intact, and title-cases the flavour for display.
 */
export function parseScale(scale: string): Answer {
  const trimmed = scale.trim()
  const space = trimmed.indexOf(' ')
  const root = (space === -1 ? trimmed : trimmed.slice(0, space)) as Root
  const rest = space === -1 ? '' : trimmed.slice(space + 1).trim()
  const flavour = rest.charAt(0).toUpperCase() + rest.slice(1)
  return { root, flavour }
}

/**
 * The set of flavours the given grooves actually use, deduped and sorted for
 * stability. Deriving it from the seed data means adding a groove with a new
 * flavour widens the pool with no other edit.
 */
export function flavourPool(grooves: Groove[]): Flavour[] {
  const flavours = grooves.map((g) => parseScale(g.scale).flavour)
  return Array.from(new Set(flavours)).sort()
}

/**
 * The day's four flavour options: the groove's own flavour plus deterministic
 * distractors from the seeded pool, seeded by the ISO date so every player sees
 * the same four, in the same order, all day.
 */
export function flavourOptions(date: Date, groove: Groove): Flavour[] {
  const correct = parseScale(groove.scale).flavour
  return buildOptions(correct, flavourPool(GROOVES), isoDate(date))
}
