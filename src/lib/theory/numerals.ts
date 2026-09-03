import type { Flavour } from '../groove'
import { perBar } from './changes'
import { FLAVOUR_LETTER_STEPS } from './notes'
import { FLAVOUR_INTERVALS, MAJOR_INTERVALS } from './scales'

const NUMERALS = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

const OFFSET_ACCIDENTAL: Record<number, string> = {
  [-2]: '♭♭',
  [-1]: '♭',
  0: '',
  1: '♯',
  2: '♯♯',
}

function lookup<T>(table: Record<string, T>, flavour: Flavour): T | undefined {
  const wanted = flavour.trim().toLowerCase()
  const key = Object.keys(table).find((name) => name.toLowerCase() === wanted)
  return key === undefined ? undefined : table[key]
}

export function romanNumeral(flavour: Flavour, degree: number): string {
  const intervals = lookup(FLAVOUR_INTERVALS, flavour)
  if (intervals === undefined) return ''
  if (!Number.isInteger(degree)) return ''
  if (degree < 0 || degree >= intervals.length) return ''

  const number = (lookup(FLAVOUR_LETTER_STEPS, flavour)?.[degree] ?? degree) + 1
  if (number < 1 || number > NUMERALS.length) return ''

  const accidental = OFFSET_ACCIDENTAL[intervals[degree] - MAJOR_INTERVALS[number - 1]]
  if (accidental === undefined) return ''

  return accidental + NUMERALS[number - 1]
}

export function barNumerals(
  flavour: Flavour,
  degrees: readonly number[] | undefined,
): string[] {
  return perBar(degrees ?? []).map((degree) =>
    degree === undefined ? '' : romanNumeral(flavour, degree),
  )
}
