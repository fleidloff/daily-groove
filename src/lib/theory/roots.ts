import type { Root } from '../groove'

export const ROOTS: Root[] = [
  'C',
  'C♯',
  'D',
  'E♭',
  'E',
  'F',
  'F♯',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
]

export function pitchClassOf(root: Root): number {
  const index = ROOTS.indexOf(root)
  if (index < 0) {
    throw new Error(`pitchClassOf: unknown root "${root}"`)
  }
  return index
}

export function midiOf(root: Root, octave: number): number {
  return (octave + 1) * 12 + pitchClassOf(root)
}

export function noteName(midi: number): Root {
  const pc = ((Math.round(midi) % 12) + 12) % 12
  return ROOTS[pc]
}
