import { pick, rngFor } from './rng.ts'
import { ADJECTIVES, NOUNS } from './words.ts'

const COMBINATIONS = ADJECTIVES.length * NOUNS.length

function draw(stream: string): string {
  const rng = rngFor(stream)
  return `${pick(rng, ADJECTIVES)} ${pick(rng, NOUNS)}`
}

export function nameFor(seedLabel: string): string {
  return draw(`${seedLabel}:name`)
}

// A name is a groove's identity in the app, so two grooves may never share one.
// The first holder keeps the name it drew and a later clash re-rolls, which is
// what keeps every name already shipped where it is.
export function namesFor(seedLabels: readonly string[]): Map<string, string> {
  const taken = new Set<string>()
  const names = new Map<string, string>()

  for (const label of seedLabels) {
    let name = nameFor(label)
    for (let attempt = 2; taken.has(name); attempt++) {
      if (attempt > COMBINATIONS) {
        throw new Error(
          `namesFor: no free name left for "${label}" after ${COMBINATIONS} draws`,
        )
      }
      name = draw(`${label}:name:${attempt}`)
    }
    taken.add(name)
    names.set(label, name)
  }

  return names
}
