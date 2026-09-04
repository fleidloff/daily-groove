import type { Answer, Flavour } from '../groove'
import { FLAVOUR_INTERVALS } from './scales'

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

export function pitchClassOfNote(note: string): number {
  const { letter, offset } = splitNote(note)
  return (NATURAL[letter] + offset + 12) % 12
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

  const { letter } = splitNote(answer.root)
  const rootLetterIndex = LETTERS.indexOf(letter as (typeof LETTERS)[number])
  const rootPitch = pitchClassOfNote(answer.root)

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
