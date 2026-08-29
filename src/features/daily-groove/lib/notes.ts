import type { Answer, Flavour } from '../types'

/**
 * A diatonic scale uses each letter name exactly once, in order from the root.
 * That rule — not a fixed choice of flats or sharps — is what makes A Dorian
 * spell A B C D E F♯ G rather than A B C D E G♭ G, which would carry two Gs and
 * no F at all. So we walk the letters and derive each accidental from the
 * semitone the interval asks for.
 */
const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const

/** Pitch class of each natural letter. */
const NATURAL: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
}

const ACCIDENTAL_OFFSET: Record<string, number> = {
  '♭♭': -2,
  '♭': -1,
  '': 0,
  '♯': 1,
  '♯♯': 2,
}

const OFFSET_ACCIDENTAL: Record<number, string> = {
  [-2]: '♭♭',
  [-1]: '♭',
  0: '',
  1: '♯',
  2: '♯♯',
}

/** Split a spelled note into its letter and its accidental offset. */
function splitNote(note: string): { letter: string; offset: number } {
  const letter = note[0].toUpperCase()
  if (!(letter in NATURAL)) throw new UnknownRootError(note)
  const accidental = note.slice(1)
  const offset = ACCIDENTAL_OFFSET[accidental]
  if (offset === undefined) throw new UnknownRootError(note)
  return { letter, offset }
}

/** Semitones from the root, for every flavour the seed set uses. */
export const FLAVOUR_INTERVALS: Record<Flavour, number[]> = {
  Major: [0, 2, 4, 5, 7, 9, 11],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Minor: [0, 2, 3, 5, 7, 8, 10],
  Locrian: [0, 1, 3, 5, 6, 8, 10],
}

/** Thrown when a flavour has no interval entry, so the gap fails loudly. */
export class UnknownFlavourError extends Error {
  constructor(flavour: Flavour) {
    super(`No interval entry for flavour "${flavour}"`)
    this.name = 'UnknownFlavourError'
  }
}

/** Thrown when a root is not one of the twelve chromatic notes. */
export class UnknownRootError extends Error {
  constructor(root: string) {
    super(`Not a chromatic root: "${root}"`)
    this.name = 'UnknownRootError'
  }
}

/** Match a flavour to its table entry, ignoring case. */
function lookup<T>(table: Record<Flavour, T>, flavour: Flavour): T | undefined {
  const wanted = flavour.trim().toLowerCase()
  const key = Object.keys(table).find((k) => k.toLowerCase() === wanted)
  return key === undefined ? undefined : table[key]
}

/**
 * The seven spelled notes of an answer's scale, in ascending order from the
 * root. Throws rather than returning a short array, so an unknown flavour
 * surfaces in tests instead of as a broken column in production.
 */
export function scaleNotes(answer: Answer): string[] {
  const intervals = lookup(FLAVOUR_INTERVALS, answer.flavour)
  if (intervals === undefined) throw new UnknownFlavourError(answer.flavour)

  const { letter, offset } = splitNote(answer.root)
  const rootLetterIndex = LETTERS.indexOf(letter as (typeof LETTERS)[number])
  const rootPitch = (NATURAL[letter] + offset + 12) % 12

  return intervals.map((semitones, degree) => {
    // One letter per degree, ascending from the root's own letter.
    const noteLetter = LETTERS[(rootLetterIndex + degree) % LETTERS.length]
    const target = (rootPitch + semitones) % 12
    // Signed distance from the natural letter to the pitch we need, folded into
    // -6..+5 so a wrap across C does not read as an eleven-semitone leap.
    const delta = (((target - NATURAL[noteLetter]) % 12) + 18) % 12 - 6
    const accidental = OFFSET_ACCIDENTAL[delta]
    if (accidental === undefined) {
      throw new UnknownFlavourError(answer.flavour)
    }
    return `${noteLetter}${accidental}`
  })
}
