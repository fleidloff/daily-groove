import type { Root } from '../../../src/lib/groove.ts'
import type { Flavour, MusicMeta } from '../types.ts'
import { pitchClassOf } from './notes.ts'
import { intervalsFor } from './scales.ts'
import type { Harmony } from './harmony.ts'
import { pitchClassesOf } from './harmony.ts'

export type ValidityRule = (args: {
  scalePitchClasses: number[]
  chordPitchClasses: number[]
  degree: number
}) => boolean

export function scaleDegreePitchClasses(root: Root, flavour: Flavour): number[] {
  const base = pitchClassOf(root)
  return intervalsFor(flavour).map((interval) => (base + interval) % 12)
}

function offsetOfDegree(scalePitchClasses: number[], degree: number): number | null {
  const rootPc = scalePitchClasses[degree]
  if (rootPc === undefined) return null
  return (((rootPc - scalePitchClasses[0]) % 12) + 12) % 12
}

function containedIn(chordPitchClasses: number[], allowed: Set<number>): boolean {
  return (
    chordPitchClasses.length > 0 &&
    chordPitchClasses.every((pc) => allowed.has(((pc % 12) + 12) % 12))
  )
}

const strictDiatonic: ValidityRule = ({ scalePitchClasses, chordPitchClasses, degree }) => {
  if (offsetOfDegree(scalePitchClasses, degree) === null) return false
  return containedIn(chordPitchClasses, new Set(scalePitchClasses))
}

const DOMINANT_SEVENTH = [0, 4, 7, 10]

const BLUES_DOMINANT_OFFSETS = [0, 5, 7]

const blues: ValidityRule = ({ scalePitchClasses, chordPitchClasses, degree }) => {
  const offset = offsetOfDegree(scalePitchClasses, degree)
  if (offset === null) return false
  const allowed = new Set(scalePitchClasses)
  if (BLUES_DOMINANT_OFFSETS.includes(offset)) {
    const chordRoot = scalePitchClasses[degree]
    for (const interval of DOMINANT_SEVENTH) allowed.add((chordRoot + interval) % 12)
  }
  return containedIn(chordPitchClasses, allowed)
}

const harmonicMinor: ValidityRule = ({ scalePitchClasses, chordPitchClasses, degree }) => {
  if (offsetOfDegree(scalePitchClasses, degree) === null) return false
  const allowed = new Set(scalePitchClasses)
  allowed.add((scalePitchClasses[0] + 11) % 12)
  return containedIn(chordPitchClasses, allowed)
}

export const VALIDITY: Record<Flavour, ValidityRule> = {
  ionian: strictDiatonic,
  aeolian: strictDiatonic,
  dorian: strictDiatonic,
  mixolydian: strictDiatonic,
  lydian: strictDiatonic,
  phrygian: strictDiatonic,
  'harmonic-minor': harmonicMinor,
  blues,
  'melodic-minor': strictDiatonic,
  'lydian-dominant': strictDiatonic,
  'phrygian-dominant': strictDiatonic,
  'harmonic-major': strictDiatonic,
}

function pitchClassesOfMidi(midi: number[]): number[] {
  return [...new Set(midi.map((m) => (((Math.round(m) % 12) + 12) % 12)))].sort((a, b) => a - b)
}

function sameSet(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

export function isValidHarmony(music: MusicMeta, harmony: Harmony): boolean {
  const rule = VALIDITY[music.flavour]
  if (!rule) return false

  const { chordMidi, chordName, progressionDegrees, progressionMidi, progressionName } = harmony
  if (progressionDegrees.length === 0) return false
  if (progressionMidi.length !== progressionDegrees.length) return false

  const names = progressionName.split('–')
  if (names.length !== progressionDegrees.length) return false
  if (music.chord !== chordName) return false
  if (music.progression !== progressionName) return false
  if (names[0] !== chordName) return false

  const scalePitchClasses = scaleDegreePitchClasses(music.root, music.flavour)

  try {
    if (!sameSet(pitchClassesOf(chordName), pitchClassesOfMidi(chordMidi))) return false

    return progressionDegrees.every((degree, i) => {
      const chordPitchClasses = pitchClassesOfMidi(progressionMidi[i])
      if (!sameSet(pitchClassesOf(names[i]), chordPitchClasses)) return false
      return rule({ scalePitchClasses, chordPitchClasses, degree })
    })
  } catch {
    return false
  }
}
