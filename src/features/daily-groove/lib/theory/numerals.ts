import type { Flavour } from '../../types'
import { perBar } from './changes'
import { FLAVOUR_INTERVALS, FLAVOUR_LETTER_STEPS } from './notes'

/**
 * The major scale, which is what a Roman numeral's accidental is measured
 * against: a degree spelled with no accidental is the one the major scale has
 * at that degree number.
 */
const MAJOR = [0, 2, 4, 5, 7, 9, 11]

/** The seven degree numbers, written the way a lead sheet writes them. */
const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

/** How far a degree sits from the major scale's, written as an accidental. */
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
  const key = Object.keys(table).find((name) => name.toLowerCase() === wanted)
  return key === undefined ? undefined : table[key]
}

/**
 * The Roman numeral for one scale-degree index of a flavour: plain UPPERCASE,
 * carrying the degree's own accidental and nothing about the quality sitting
 * above it on the symbol. Blues + 3 → '♭V'; Mixolydian + 6 → '♭VII';
 * Lydian + 3 → '♯IV'.
 *
 * Takes a flavour and not an answer: the numerals are counted from the day's
 * root, so index 0 is always 'I' and there is no root here to count from
 * anything else (R2b).
 *
 * Total: '' for an unknown flavour or an index the scale does not have. Never
 * throws. That it does not is a decision and not an oversight: `scaleDegrees`
 * throws `UnknownFlavourError` because it names the scale's own notes and a gap
 * there is a broken drawing, while a numeral is less load-bearing than a bar and
 * a data gap must not crash the day's payoff (R8).
 */
export function romanNumeral(flavour: Flavour, degree: number): string {
  const intervals = lookup(FLAVOUR_INTERVALS, flavour)
  if (intervals === undefined) return ''
  if (!Number.isInteger(degree)) return ''
  if (degree < 0 || degree >= intervals.length) return ''

  // Which degree number this index is. For a seven-note flavour the indices are
  // consecutive degrees, so it is the index + 1. For a flavour whose length is
  // not seven they are not — the blues scale has six degrees whose numbers are
  // `1 3 4 5 5 7` — and `FLAVOUR_LETTER_STEPS` already declares them, which is
  // the same table `notes.ts` spells those scales from and the same rule the
  // staff's arabic labels follow. Deriving the number from the semitone instead
  // would need a second rule to keep Lydian's ♯IV from reading ♭V.
  const number = (lookup(FLAVOUR_LETTER_STEPS, flavour)?.[degree] ?? degree) + 1
  if (number < 1 || number > NUMERALS.length) return ''

  const accidental = OFFSET_ACCIDENTAL[intervals[degree] - MAJOR[number - 1]]
  if (accidental === undefined) return ''

  return accidental + NUMERALS[number - 1]
}

/**
 * One numeral per bar of the four-bar figure, mapped by `perBar` — the same
 * function the symbols are mapped through — so bar four of a three-degree
 * figure carries bar one's numeral and a symbol and a numeral in one bar always
 * describe the same chord (R2).
 *
 * '' where a bar has no numeral, and four empty strings when there are no
 * degrees at all: the field is optional, so where the degrees are missing the
 * numerals are missing and the bars are not (R4a, R8).
 */
export function barNumerals(
  flavour: Flavour,
  degrees: readonly number[] | undefined,
): string[] {
  return perBar(degrees ?? []).map((degree) =>
    degree === undefined ? '' : romanNumeral(flavour, degree),
  )
}
