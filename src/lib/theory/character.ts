import type { Flavour } from '../groove'

export type ModeCharacter = {
  degrees: string[]
}

export const MODE_CHARACTERS: Record<Flavour, ModeCharacter> = {
  Ionian: { degrees: [] },
  Lydian: { degrees: ['♯4'] },
  Mixolydian: { degrees: ['♭7'] },
  'Lydian dominant': { degrees: ['♯4', '♭7'] },
  'Phrygian dominant': { degrees: ['♭2', '♭6', '♭7'] },
  'Harmonic major': { degrees: ['♭6'] },
  Aeolian: { degrees: [] },
  Dorian: { degrees: ['6'] },
  Phrygian: { degrees: ['♭2'] },
  'Harmonic minor': { degrees: ['7'] },
  'Melodic minor': { degrees: ['6', '7'] },
  Blues: { degrees: ['♭5'] },
}

export function characterOf(flavour: Flavour): ModeCharacter | undefined {
  const wanted = flavour.trim().toLowerCase()
  const key = Object.keys(MODE_CHARACTERS).find((k) => k.toLowerCase() === wanted)
  return key === undefined ? undefined : MODE_CHARACTERS[key]
}
