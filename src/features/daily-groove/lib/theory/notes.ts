import type { Answer, Flavour } from '../../types'

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const

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

function splitNote(note: string): { letter: string; offset: number } {
  const letter = note[0].toUpperCase()
  if (!(letter in NATURAL)) throw new UnknownRootError(note)
  const accidental = note.slice(1)
  const offset = ACCIDENTAL_OFFSET[accidental]
  if (offset === undefined) throw new UnknownRootError(note)
  return { letter, offset }
}

export const FLAVOUR_INTERVALS: Record<Flavour, number[]> = {
  Ionian: [0, 2, 4, 5, 7, 9, 11],
  Dorian: [0, 2, 3, 5, 7, 9, 10],
  Phrygian: [0, 1, 3, 5, 7, 8, 10],
  Lydian: [0, 2, 4, 6, 7, 9, 11],
  Mixolydian: [0, 2, 4, 5, 7, 9, 10],
  Aeolian: [0, 2, 3, 5, 7, 8, 10],
  Locrian: [0, 1, 3, 5, 6, 8, 10],
  'Harmonic minor': [0, 2, 3, 5, 7, 8, 11],
  Blues: [0, 3, 5, 6, 7, 10],
  'Melodic minor': [0, 2, 3, 5, 7, 9, 11],
  'Lydian dominant': [0, 2, 4, 6, 7, 9, 10],
  'Phrygian dominant': [0, 1, 4, 5, 7, 8, 10],
  'Harmonic major': [0, 2, 4, 5, 7, 8, 11],
}

export const FLAVOUR_LETTER_STEPS: Record<string, number[]> = {
  Blues: [0, 2, 3, 4, 4, 6],
}

export class UnknownFlavourError extends Error {
  constructor(flavour: Flavour) {
    super(`No interval entry for flavour "${flavour}"`)
    this.name = 'UnknownFlavourError'
  }
}

export class UnknownRootError extends Error {
  constructor(root: string) {
    super(`Not a chromatic root: "${root}"`)
    this.name = 'UnknownRootError'
  }
}

function lookup<T>(table: Record<Flavour, T>, flavour: Flavour): T | undefined {
  const wanted = flavour.trim().toLowerCase()
  const key = Object.keys(table).find((k) => k.toLowerCase() === wanted)
  return key === undefined ? undefined : table[key]
}

export function scaleNotes(answer: Answer): string[] {
  const intervals = lookup(FLAVOUR_INTERVALS, answer.flavour)
  if (intervals === undefined) throw new UnknownFlavourError(answer.flavour)

  const { letter, offset } = splitNote(answer.root)
  const rootLetterIndex = LETTERS.indexOf(letter as (typeof LETTERS)[number])
  const rootPitch = (NATURAL[letter] + offset + 12) % 12

  const letterSteps = FLAVOUR_LETTER_STEPS[answer.flavour]

  return intervals.map((semitones, degree) => {
    const step = letterSteps ? letterSteps[degree] : degree
    const noteLetter = LETTERS[(rootLetterIndex + step) % LETTERS.length]
    const target = (rootPitch + semitones) % 12
    const delta = (((target - NATURAL[noteLetter]) % 12) + 18) % 12 - 6
    const accidental = OFFSET_ACCIDENTAL[delta]
    if (accidental === undefined) {
      throw new UnknownFlavourError(answer.flavour)
    }
    return `${noteLetter}${accidental}`
  })
}
