import type { Answer, Attempt, Flavour } from '../../types'
import { familyOf } from '../theory/families'

/**
 * How the flavour half of a guess is compared against the day's answer.
 *
 * A parameter rather than a branch inside the scorer: simple mode's guess is
 * `'Major'` or `'Minor'`, which is not a mode and can never equal one, so the
 * comparison has to change while everything else about a scored attempt stays
 * put. Injecting it keeps one scoring path, one `Attempt` shape and one
 * feedback module.
 */
export type FlavourMatcher = (answer: Flavour, guess: Flavour) => boolean

/** The full puzzle: the guess must be the mode itself. */
export const exactMatch: FlavourMatcher = (answer, guess) => answer === guess

/**
 * Simple mode: the guess must be the mode's family. Throws by way of
 * `familyOf` if the day's mode has no family, rather than grading every guess
 * against it as a miss.
 */
export const familyMatch: FlavourMatcher = (answer, guess) =>
  familyOf(answer) === guess

/**
 * Score one guessed pair against the day's answer. A guess is correct only when
 * both halves match; the per-half flags are carried through so the UI can say
 * which half was right.
 *
 * `matchFlavour` defaults to the exact comparison, so a two-argument call
 * scores exactly as it always has.
 */
export function scoreAttempt(
  answer: Answer,
  guess: Answer,
  matchFlavour: FlavourMatcher = exactMatch,
): Attempt {
  const rootMatched = answer.root === guess.root
  const flavourMatched = matchFlavour(answer.flavour, guess.flavour)
  return {
    root: guess.root,
    flavour: guess.flavour,
    correct: rootMatched && flavourMatched,
    rootMatched,
    flavourMatched,
  }
}
