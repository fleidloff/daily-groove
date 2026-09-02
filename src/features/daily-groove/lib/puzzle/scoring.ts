import type { Answer, Attempt, Flavour } from '../../types'
import { familyOf } from '../theory/families'

export type FlavourMatcher = (answer: Flavour, guess: Flavour) => boolean

export const exactMatch: FlavourMatcher = (answer, guess) => answer === guess

export const familyMatch: FlavourMatcher = (answer, guess) =>
  familyOf(answer) === guess

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
