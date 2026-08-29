import type { FeelTemplate } from '../types.ts'
import { straightFunk } from './straight-funk.ts'
import { shuffle } from './shuffle.ts'
import { brightStraight } from './bright-straight.ts'
import { halfTime } from './half-time.ts'

/**
 * Every feel template, by id.
 *
 * The four flavour pairs are disjoint and their union is exactly the eight
 * flavours the game offers (R2, R5, AC15) — dorian and mixolydian on the funk,
 * blues and minor on the shuffle, lydian and major on the bright feel,
 * phrygian and harmonic minor on the half-time. `templates/index.test.ts`
 * asserts that, and it is what makes the game's chip row honest.
 */
export const TEMPLATES: Record<string, FeelTemplate> = {
  [straightFunk.id]: straightFunk,
  [shuffle.id]: shuffle,
  [brightStraight.id]: brightStraight,
  [halfTime.id]: halfTime,
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

export { straightFunk, shuffle, brightStraight, halfTime }
