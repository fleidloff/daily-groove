import type { Flavour } from '../../types'

/**
 * The two answers simple mode offers in place of the mode row.
 *
 * They are families, not modes: a mode is graded by its third, and every mode
 * the rotation plays has one. This lives beside the vocabulary in
 * `lib/theory/` rather than inside the card, because it is a fact about music
 * and not about a chip row.
 */
export type Family = 'Major' | 'Minor'

/** Both families, in the order the second row offers them. */
export const FAMILIES: Family[] = ['Major', 'Minor']

/**
 * Which family each mode belongs to, graded by its third.
 *
 * Total over exactly the six modes the rotation plays. Locrian is absent
 * deliberately: its fifth is diminished, so it is neither of these two answers
 * in any honest reading — which is why the catalogue no longer carries it.
 */
const FAMILY_OF: Record<string, Family> = {
  // Major third.
  Ionian: 'Major',
  Lydian: 'Major',
  Mixolydian: 'Major',
  // Minor third.
  Dorian: 'Minor',
  Phrygian: 'Minor',
  Aeolian: 'Minor',
}

/** Thrown when a mode has no family, so the gap fails loudly. */
export class UnknownFamilyError extends Error {
  constructor(mode: Flavour) {
    super(`No family for mode "${mode}"`)
    this.name = 'UnknownFamilyError'
  }
}

/**
 * The family a mode is graded into in simple mode.
 *
 * Throws rather than defaulting. A mode with no family is a bug in the
 * vocabulary, and silently calling it minor would make its day unwinnable with
 * no signal anywhere — the player would press the only two options the row
 * offers and be told both are wrong.
 */
export function familyOf(mode: Flavour): Family {
  if (!Object.hasOwn(FAMILY_OF, mode)) throw new UnknownFamilyError(mode)
  return FAMILY_OF[mode]
}
