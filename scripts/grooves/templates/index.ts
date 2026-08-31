import type { FeelTemplate } from '../types.ts'
import { straightFunk } from './straight-funk.ts'
import { shuffle } from './shuffle.ts'
import { brightStraight } from './bright-straight.ts'
import { halfTime } from './half-time.ts'
import { openBallad } from './open-ballad.ts'
import { swungSixteenth } from './swung-sixteenth.ts'

/**
 * Every feel template, by id.
 *
 * The six flavour pairs are disjoint and their union is exactly the twelve
 * flavours the game offers (R2, R2a, AC2) — dorian and mixolydian on the funk,
 * blues and aeolian on the shuffle, lydian and ionian on the bright feel,
 * phrygian and harmonic minor on the half-time, melodic minor and lydian
 * dominant on the double-time, phrygian dominant and harmonic major on the
 * swung-sixteenth. `templates/index.test.ts` asserts that, and it is what makes
 * the game's chip row honest: hearing the feel narrows the answer to two.
 *
 * The two Epic 6 added carry pairs that are related rather than merely
 * different, which is what keeps the narrowing fair once the pool is twelve
 * wide. Melodic minor and lydian dominant are one scale heard two ways — the
 * second is the fourth mode of the first — so the pair cannot be told apart by
 * note content, only by the tonic. Phrygian dominant and harmonic major both
 * put a ♭6 against a major third and differ in the second alone.
 *
 * The set is also balanced by family, because the app's simple mode grades
 * every mode as Major or Minor by its third and offers exactly those two
 * answers. The original eight are three major-third and five minor-third, so
 * the four added here are three major (lydian dominant, phrygian dominant,
 * harmonic major) and one minor (melodic minor), taking the twelve to six and
 * six. Two of each — the obvious split — would have produced five and seven and
 * made *Minor* the better blind guess (R6b, R6c, AC2b).
 */
export const TEMPLATES: Record<string, FeelTemplate> = {
  [straightFunk.id]: straightFunk,
  [shuffle.id]: shuffle,
  [brightStraight.id]: brightStraight,
  [halfTime.id]: halfTime,
  [openBallad.id]: openBallad,
  [swungSixteenth.id]: swungSixteenth,
}

/** Look up a template, throwing on an unknown id rather than returning undefined. */
export function templateById(id: string): FeelTemplate {
  const template = TEMPLATES[id]
  if (!template) {
    throw new Error(`templateById: unknown template "${id}"`)
  }
  return template
}

/** Every registered template, for callers that rotate over the whole set. */
export function allTemplates(): FeelTemplate[] {
  return Object.values(TEMPLATES)
}

export { straightFunk, shuffle, brightStraight, halfTime, openBallad, swungSixteenth }
