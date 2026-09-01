import type { Answer, Attempt } from '../../types'
import { FAMILIES } from '../theory/families'
import { degreeDifferences, type DegreeDifference } from '../theory/difference'
import { FLAVOUR_INTERVALS } from '../theory/notes'

/** How the count of differing degrees is spoken, up to the threshold. */
const NOTE_COUNT: Record<number, string> = {
  1: 'one note',
  2: 'two notes',
}

/**
 * The last guess that missed, or `undefined` where none did.
 *
 * Scanned from the end rather than read off the tail the way `selectFeedback`
 * does: that function runs mid-puzzle, where the last attempt is always the
 * last miss, and this one runs after the day has ended, where the last attempt
 * on a solved day is the right one.
 */
function lastIncorrect(attempts: Attempt[]): Attempt | undefined {
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    if (!attempts[index].correct) return attempts[index]
  }
  return undefined
}

/**
 * Whether the interval table holds this flavour, matched case-insensitively as
 * `notes.ts` matches it — so the guard is true exactly when the comparison
 * would not throw.
 */
function comparable(flavour: string): boolean {
  const wanted = flavour.trim().toLowerCase()
  return Object.keys(FLAVOUR_INTERVALS).some((key) => key.toLowerCase() === wanted)
}

/**
 * One side of the comparison, read across the differing degrees in degree
 * order — so the guess's labels and the answer's read in the same order, one
 * list beneath the other, rather than being paired off degree by degree.
 */
function spell(differences: DegreeDifference[], side: 'guess' | 'answer'): string {
  return differences.flatMap((difference) => difference[side]).join(' and ')
}

/**
 * The near-miss line for a finished day, or `undefined` where there is nothing
 * to say — no incorrect attempt, or one made in simple mode.
 *
 * Reads the last incorrect attempt and the answer, and nothing about how the
 * day ended: a solved day and a given-up day get the same sentence (R11).
 */
export function selectNearMiss(attempts: Attempt[], answer: Answer): string | undefined {
  const attempt = lastIncorrect(attempts)
  if (!attempt) return undefined

  // Simple mode's guess is scored against `familyOf(answer)`, so what is stored
  // is 'Major' or 'Minor' — a family, which has no intervals to compare and
  // would throw `UnknownFlavourError` in the arithmetic below. A membership
  // test in the declared list, never a heuristic (R5, R5a).
  if (FAMILIES.some((family) => family === attempt.flavour)) return undefined

  // The colour half and the root half are stored separately, so they are never
  // conflated into one distance. A guess that missed both is a wrong-colour
  // guess: the mode difference is the transferable half, and the nudge has
  // already handed over the root.
  if (attempt.flavourMatched) {
    return `You said ${attempt.flavour} — the colour was right, not the home note.`
  }

  // A gap in the table is a missing line, not a broken payoff panel: a stored
  // flavour the table cannot read gets no sentence rather than an exception on
  // the one screen that owes the player the answer.
  if (!comparable(attempt.flavour) || !comparable(answer.flavour)) return undefined

  const differences = degreeDifferences(attempt.flavour, answer.flavour)
  // Two names for one scale — nothing to name.
  if (differences.length === 0) return undefined
  const spoken = NOTE_COUNT[differences.length]

  // Past the threshold, or where either scale has no note at a degree the
  // other does, the line stops listing and says so plainly. A three-degree
  // list is a table written as prose, and a scale with a different number of
  // notes is the definition of a long way from this one — so the length
  // mismatch folds into the same sentence rather than getting prose of its own.
  const spellable = differences.every(
    (difference) => difference.guess.length === 1 && difference.answer.length === 1,
  )
  if (spoken === undefined || !spellable) {
    return `You said ${attempt.flavour} — a long way from this one, not a near miss.`
  }

  const guessed = spell(differences, 'guess')
  const answered = spell(differences, 'answer')
  return `You said ${attempt.flavour} — ${spoken} apart: ${guessed}, not ${answered}.`
}
