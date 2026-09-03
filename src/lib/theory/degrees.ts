import type { Answer, Flavour } from '../groove'
import { FLAVOUR_LETTER_STEPS, UnknownFlavourError } from './notes'
import { FLAVOUR_INTERVALS, MAJOR_INTERVALS } from './scales'

const OFFSET_ACCIDENTAL: Record<number, string> = {
  [-2]: '♭♭',
  [-1]: '♭',
  0: '',
  1: '♯',
  2: '♯♯',
}

function lookup<T>(table: Record<string, T>, flavour: Flavour): T | undefined {
  const wanted = flavour.trim().toLowerCase()
  const key = Object.keys(table).find((k) => k.toLowerCase() === wanted)
  return key === undefined ? undefined : table[key]
}

export function scaleDegrees(answer: Answer): string[] {
  const intervals = lookup(FLAVOUR_INTERVALS, answer.flavour)
  if (intervals === undefined) throw new UnknownFlavourError(answer.flavour)

  const letterSteps = lookup(FLAVOUR_LETTER_STEPS, answer.flavour)

  return intervals.map((semitones, index) => {
    const number = (letterSteps?.[index] ?? index) + 1
    const delta = semitones - MAJOR_INTERVALS[number - 1]
    const accidental = OFFSET_ACCIDENTAL[delta]
    if (accidental === undefined) throw new UnknownFlavourError(answer.flavour)
    return `${accidental}${number}`
  })
}
