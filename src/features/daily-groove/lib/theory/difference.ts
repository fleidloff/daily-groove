import type { Flavour } from '../../types'
import { scaleDegrees } from './degrees'
import { FLAVOUR_INTERVALS, UnknownFlavourError } from './notes'

export type DegreeDifference = {
  number: number
  guess: string[]
  answer: string[]
}

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

function known(flavour: Flavour): boolean {
  const wanted = flavour.trim().toLowerCase()
  return Object.keys(FLAVOUR_INTERVALS).some((k) => k.toLowerCase() === wanted)
}

function sameLabels(a: string[], b: string[]): boolean {
  return a.length === b.length && a.every((label, index) => label === b[index])
}

export function degreeDifferences(guess: Flavour, answer: Flavour): DegreeDifference[] {
  for (const flavour of [guess, answer]) {
    if (!known(flavour)) throw new UnknownFlavourError(flavour)
  }

  const guessed = labelsByDegree(guess)
  const answered = labelsByDegree(answer)

  const differences: DegreeDifference[] = []
  const numbers = [...new Set([...guessed.keys(), ...answered.keys()])].sort(
    (a, b) => a - b,
  )
  for (const number of numbers) {
    const mine = guessed.get(number) ?? []
    const theirs = answered.get(number) ?? []
    if (!sameLabels(mine, theirs)) {
      differences.push({ number, guess: mine, answer: theirs })
    }
  }
  return differences
}
