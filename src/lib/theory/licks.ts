import type { Flavour } from '../groove'

export type LickNote = {
  degree: number
  beat: number
  beats: number
}

export const LICKS: Record<Flavour, LickNote[]> = {
  Ionian: [
    { degree: 0, beat: 0, beats: 0.5 },
    { degree: 2, beat: 0.5, beats: 0.5 },
    { degree: 4, beat: 1, beats: 0.5 },
    { degree: 5, beat: 1.5, beats: 0.5 },
    { degree: 7, beat: 2, beats: 0.5 },
    { degree: 6, beat: 2.5, beats: 0.5 },
    { degree: 3, beat: 3, beats: 0.5 },
    { degree: 2, beat: 3.5, beats: 1 },
  ],

  Dorian: [
    { degree: 0, beat: 0, beats: 0.75 },
    { degree: 2, beat: 0.75, beats: 0.25 },
    { degree: 5, beat: 1, beats: 0.75 },
    { degree: 4, beat: 1.75, beats: 0.25 },
    { degree: 6, beat: 2, beats: 0.5 },
    { degree: 5, beat: 2.5, beats: 0.75 },
    { degree: 3, beat: 3.25, beats: 0.25 },
    { degree: 2, beat: 3.5, beats: 1 },
  ],

  Phrygian: [
    { degree: 7, beat: 0, beats: 0.5 },
    { degree: 6, beat: 0.5, beats: 0.5 },
    { degree: 5, beat: 1, beats: 0.5 },
    { degree: 4, beat: 1.5, beats: 1 },
    { degree: 2, beat: 2.5, beats: 0.5 },
    { degree: 1, beat: 3, beats: 0.5 },
    { degree: 0, beat: 3.5, beats: 1 },
  ],

  Lydian: [
    { degree: 0, beat: 0, beats: 0.75 },
    { degree: 2, beat: 0.75, beats: 0.75 },
    { degree: 3, beat: 1.5, beats: 1 },
    { degree: 4, beat: 2.5, beats: 0.5 },
    { degree: 3, beat: 3, beats: 0.5 },
    { degree: 6, beat: 3.5, beats: 0.5 },
    { degree: 7, beat: 4, beats: 0.5 },
  ],

  Mixolydian: [
    { degree: 0, beat: 0, beats: 0.5 },
    { degree: 2, beat: 0.5, beats: 0.25 },
    { degree: 3, beat: 0.75, beats: 0.25 },
    { degree: 4, beat: 1, beats: 0.5 },
    { degree: 6, beat: 1.5, beats: 1 },
    { degree: 5, beat: 2.5, beats: 0.5 },
    { degree: 2, beat: 3, beats: 0.5 },
    { degree: 0, beat: 3.5, beats: 0.75 },
  ],

  Aeolian: [
    { degree: 0, beat: 0, beats: 0.5 },
    { degree: 1, beat: 0.5, beats: 0.5 },
    { degree: 2, beat: 1, beats: 1 },
    { degree: 5, beat: 2, beats: 0.5 },
    { degree: 4, beat: 2.5, beats: 0.5 },
    { degree: 6, beat: 3, beats: 0.5 },
    { degree: 0, beat: 3.5, beats: 1 },
  ],

  Blues: [
    { degree: 1, beat: 0, beats: 0.5 },
    { degree: 2, beat: 0.5, beats: 0.25 },
    { degree: 3, beat: 0.75, beats: 0.25 },
    { degree: 4, beat: 1, beats: 0.75 },
    { degree: 5, beat: 1.75, beats: 0.75 },
    { degree: 4, beat: 2.5, beats: 0.5 },
    { degree: 2, beat: 3, beats: 0.5 },
    { degree: 0, beat: 3.5, beats: 1 },
  ],

  'Harmonic minor': [
    { degree: 0, beat: 0, beats: 0.5 },
    { degree: 2, beat: 0.5, beats: 0.5 },
    { degree: 4, beat: 1, beats: 0.5 },
    { degree: 5, beat: 1.5, beats: 0.25 },
    { degree: 6, beat: 1.75, beats: 0.25 },
    { degree: 7, beat: 2, beats: 1 },
    { degree: 6, beat: 3, beats: 0.25 },
    { degree: 5, beat: 3.25, beats: 0.25 },
    { degree: 4, beat: 3.5, beats: 1 },
  ],

  'Melodic minor': [
    { degree: 0, beat: 0, beats: 0.25 },
    { degree: 2, beat: 0.25, beats: 0.25 },
    { degree: 4, beat: 0.5, beats: 0.25 },
    { degree: 5, beat: 0.75, beats: 0.25 },
    { degree: 6, beat: 1, beats: 0.25 },
    { degree: 7, beat: 1.25, beats: 0.75 },
    { degree: 6, beat: 2, beats: 0.5 },
    { degree: 5, beat: 2.5, beats: 0.5 },
    { degree: 2, beat: 3, beats: 1.25 },
  ],

  'Harmonic major': [
    { degree: 0, beat: 0, beats: 0.5 },
    { degree: 2, beat: 0.5, beats: 0.5 },
    { degree: 4, beat: 1, beats: 0.5 },
    { degree: 5, beat: 1.5, beats: 1 },
    { degree: 6, beat: 2.5, beats: 0.75 },
    { degree: 2, beat: 3.25, beats: 0.25 },
    { degree: 0, beat: 3.5, beats: 1 },
  ],

  'Lydian dominant': [
    { degree: 0, beat: 0, beats: 0.75 },
    { degree: 3, beat: 0.75, beats: 0.75 },
    { degree: 4, beat: 1.5, beats: 0.75 },
    { degree: 6, beat: 2.25, beats: 0.75 },
    { degree: 3, beat: 3, beats: 0.5 },
    { degree: 2, beat: 3.5, beats: 1 },
  ],

  'Phrygian dominant': [
    { degree: 0, beat: 0, beats: 0.5 },
    { degree: 1, beat: 0.5, beats: 0.25 },
    { degree: 2, beat: 0.75, beats: 0.25 },
    { degree: 1, beat: 1, beats: 0.5 },
    { degree: 0, beat: 1.5, beats: 0.5 },
    { degree: 4, beat: 2, beats: 0.5 },
    { degree: 5, beat: 2.5, beats: 0.25 },
    { degree: 4, beat: 2.75, beats: 0.25 },
    { degree: 2, beat: 3, beats: 0.5 },
    { degree: 1, beat: 3.5, beats: 0.25 },
    { degree: 0, beat: 3.75, beats: 0.75 },
  ],
}

export function lickFor(flavour: Flavour): LickNote[] | null {
  const wanted = flavour.trim().toLowerCase()
  if (wanted === '') return null
  const key = Object.keys(LICKS).find((k) => k.toLowerCase() === wanted)
  return key === undefined ? null : LICKS[key]
}
