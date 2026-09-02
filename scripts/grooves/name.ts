import { pick, rngFor } from './rng.ts'
import { ADJECTIVES, NOUNS } from './words.ts'

export function nameFor(seedLabel: string): string {
  const rng = rngFor(`${seedLabel}:name`)
  return `${pick(rng, ADJECTIVES)} ${pick(rng, NOUNS)}`
}
