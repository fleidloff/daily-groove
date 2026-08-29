import type { Answer, Attempt } from '../types'

/**
 * Score one guessed pair against the day's answer. A guess is correct only when
 * both halves match; the per-half flags are carried through so the UI can say
 * which half was right.
 */
export function scoreAttempt(answer: Answer, guess: Answer): Attempt {
  const rootMatched = answer.root === guess.root
  const flavourMatched = answer.flavour === guess.flavour
  return {
    root: guess.root,
    flavour: guess.flavour,
    correct: rootMatched && flavourMatched,
    rootMatched,
    flavourMatched,
  }
}
