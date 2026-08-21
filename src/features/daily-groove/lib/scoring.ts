import type { Attribute, Groove } from '../types'

/**
 * Score a single attribute guess by exact string equality against the groove's
 * absolute value. Reused unchanged by Epic 2 for chord/progression.
 */
export function scoreAttribute(
  groove: Groove,
  attribute: Attribute,
  guess: string,
): boolean {
  return groove[attribute] === guess
}

/**
 * Score only the attempted attributes — the keys present in `guesses`. Folds
 * `scoreAttribute` over those keys, returning a correctness map with one entry
 * per attempted attribute and no entry for un-attempted ones.
 */
export function scoreSelected(
  groove: Groove,
  guesses: Partial<Record<Attribute, string>>,
): Partial<Record<Attribute, boolean>> {
  const correctness: Partial<Record<Attribute, boolean>> = {}
  for (const attribute of Object.keys(guesses) as Attribute[]) {
    const guess = guesses[attribute]
    if (guess === undefined) continue
    correctness[attribute] = scoreAttribute(groove, attribute, guess)
  }
  return correctness
}
