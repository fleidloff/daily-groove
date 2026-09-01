import type { Answer, Flavour } from '../../types'
import {
  FLAVOUR_INTERVALS,
  FLAVOUR_LETTER_STEPS,
  UnknownFlavourError,
} from './notes'

/** Semitones from the root of each degree of the major scale. */
const MAJOR_INTERVALS = [0, 2, 4, 5, 7, 9, 11]

const OFFSET_ACCIDENTAL: Record<number, string> = {
  [-2]: '♭♭',
  [-1]: '♭',
  0: '',
  1: '♯',
  2: '♯♯',
}

/** Match a flavour to its table entry, ignoring case, as `notes.ts` does. */
function lookup<T>(table: Record<string, T>, flavour: Flavour): T | undefined {
  const wanted = flavour.trim().toLowerCase()
  const key = Object.keys(table).find((k) => k.toLowerCase() === wanted)
  return key === undefined ? undefined : table[key]
}

/**
 * The scale's degrees, ascending from the root, one per note:
 * Mixolydian → ['1','2','3','4','5','6','♭7']; blues → ['1','♭3','4','♭5','5','♭7'].
 * Same length and order as `scaleNotes(answer)`.
 */
export function scaleDegrees(answer: Answer): string[] {
  const intervals = lookup(FLAVOUR_INTERVALS, answer.flavour)
  if (intervals === undefined) throw new UnknownFlavourError(answer.flavour)

  const letterSteps = lookup(FLAVOUR_LETTER_STEPS, answer.flavour)

  return intervals.map((semitones, index) => {
    // The degree *number* comes from the letter the degree takes, not from the
    // semitone. A scale whose degrees are not consecutive declares those
    // letters — the blues scale's are [0,2,3,4,4,6], so it numbers 1 3 4 5 5 7
    // and its fourth entry reads ♭5 rather than ♭4.
    const number = (letterSteps?.[index] ?? index) + 1
    // The accidental is the signed distance from the major scale's interval at
    // that same degree number. Deriving the number from the semitone instead
    // would turn Mixolydian's 10 into ♯6 and Lydian's 6 into ♭5.
    const delta = semitones - MAJOR_INTERVALS[number - 1]
    const accidental = OFFSET_ACCIDENTAL[delta]
    if (accidental === undefined) throw new UnknownFlavourError(answer.flavour)
    return `${accidental}${number}`
  })
}
