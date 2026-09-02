import type { Flavour } from '../../types'

export type ModeCharacter = {
  degrees: string[]
  line: string
}

export const MODE_CHARACTERS: Record<Flavour, ModeCharacter> = {
  Ionian: {
    degrees: [],
    line: 'the plain major scale — nothing bent, that’s the sound of it',
  },
  Lydian: {
    degrees: ['♯4'],
    line: 'major with a ♯4 — that’s the note doing it',
  },
  Mixolydian: {
    degrees: ['♭7'],
    line: 'major with a ♭7 — that’s the note doing it',
  },
  'Lydian dominant': {
    degrees: ['♯4', '♭7'],
    line: 'major with a ♯4 and a ♭7 — those are the notes doing it',
  },
  'Phrygian dominant': {
    degrees: ['♭2', '♭6', '♭7'],
    line: 'major with a ♭2, a ♭6 and a ♭7 — those are the notes doing it',
  },
  'Harmonic major': {
    degrees: ['♭6'],
    line: 'major with a ♭6 — that’s the note doing it',
  },
  Aeolian: {
    degrees: [],
    line: 'the plain minor scale — nothing bent, that’s the sound of it',
  },
  Dorian: {
    degrees: ['6'],
    line: 'minor with a 6 where the ♭6 would be — that’s the note doing it',
  },
  Phrygian: {
    degrees: ['♭2'],
    line: 'minor with a ♭2 — that’s the note doing it',
  },
  'Harmonic minor': {
    degrees: ['7'],
    line: 'minor with a 7 where the ♭7 would be — that’s the note doing it',
  },
  'Melodic minor': {
    degrees: ['6', '7'],
    line: 'minor with a 6 and a 7 where the ♭6 and ♭7 would be',
  },
  Blues: {
    degrees: ['♭5'],
    line: 'the blues scale, not the 12-bar form — that ♭5 between the 4 and the 5',
  },
}

export function characterOf(flavour: Flavour): ModeCharacter | undefined {
  const wanted = flavour.trim().toLowerCase()
  const key = Object.keys(MODE_CHARACTERS).find((k) => k.toLowerCase() === wanted)
  return key === undefined ? undefined : MODE_CHARACTERS[key]
}
