import { pick, rngFor } from './rng.ts'
import { ADJECTIVES, NOUNS } from './words.ts'

/**
 * A groove's display name: one adjective and one noun, paired by a generator
 * seeded from the groove's own label. Deterministic, so the same catalogue
 * entry always carries the same name, and drawn from a vocabulary that holds
 * no note or mode name, so the name never gives away the day's answer.
 */
export function nameFor(seedLabel: string): string {
  const rng = rngFor(`${seedLabel}:name`)
  return `${pick(rng, ADJECTIVES)} ${pick(rng, NOUNS)}`
}
