import type { Flavour } from '../../types'
import { scaleDegrees } from './degrees'
import { FLAVOUR_INTERVALS, UnknownFlavourError } from './notes'

/** One degree number the two scales disagree at. */
export type DegreeDifference = {
  /** The degree number, 1–7. */
  number: number
  /**
   * How the guessed scale spells that degree, in scale order: `['♭3']`,
   * `['♭5','5']` on the blues fifth, `[]` where it has no note there at all.
   */
  guess: string[]
  /** How the answer spells it, same convention. */
  answer: string[]
}

/**
 * The scale's degree labels grouped by degree number, in scale order. The
 * number is read back off Epic 1's label rather than re-derived from
 * `FLAVOUR_INTERVALS`: a label is an accidental followed by a number by
 * `scaleDegrees`' contract, and re-deriving it would put a second copy of the
 * arithmetic that makes the blues fourth read ♭5 in a second file.
 */
function labelsByDegree(flavour: Flavour): Map<number, string[]> {
  const grouped = new Map<number, string[]>()
  for (const label of scaleDegrees({ root: 'C', flavour })) {
    const number = Number(label.replace(/\D/g, ''))
    const existing = grouped.get(number)
    if (existing === undefined) grouped.set(number, [label])
    else existing.push(label)
  }
  return grouped
}

/**
 * Whether the interval table holds the flavour, matched the way `notes.ts` and
 * `degrees.ts` match it — trimmed and case-insensitively — so this guard is
 * never stricter than the speller it is guarding.
 */
function known(flavour: Flavour): boolean {
  const wanted = flavour.trim().toLowerCase()
  return Object.keys(FLAVOUR_INTERVALS).some((k) => k.toLowerCase() === wanted)
}

function sameLabels(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((label, index) => label === b[index])
}

/**
 * Every degree number at which two scales disagree, ascending. `[]` when they
 * are the same scale. Takes flavours and no root, because a degree difference
 * is the same difference in every key (R7a) — `'C'` below is a placeholder.
 */
export function degreeDifferences(guess: Flavour, answer: Flavour): DegreeDifference[] {
  // Both flavours are checked here, before anything is compared, rather than
  // being left to `scaleDegrees`' own throw standing behind this one. The throw
  // is this function's contract, not an accident of its first call: it is the
  // failure `selectNearMiss` refuses to reach with a family ('Major'/'Minor'),
  // and a version that returned [] there would make that guard unprovable.
  for (const flavour of [guess, answer]) {
    if (!known(flavour)) throw new UnknownFlavourError(flavour)
  }

  const guessed = labelsByDegree(guess)
  const answered = labelsByDegree(answer)

  const differences: DegreeDifference[] = []
  // Sorted, not walked in insertion order: the blues scale's degree numbers
  // are 1 3 4 5 5 7, so the union of a blues map and a mode's would otherwise
  // read 1 3 4 5 7 2 6 and the differences would come out unordered.
  const numbers = [...new Set([...guessed.keys(), ...answered.keys()])].sort(
    (a, b) => a - b,
  )
  for (const number of numbers) {
    // A degree one scale has no note at is a disagreement, not a skip: the
    // blues scale has nothing at the 2nd or the 6th, and that is part of what
    // separates it from a seven-note mode.
    const mine = guessed.get(number) ?? []
    const theirs = answered.get(number) ?? []
    if (!sameLabels(mine, theirs)) {
      differences.push({ number, guess: mine, answer: theirs })
    }
  }
  return differences
}
