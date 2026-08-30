import type { Root } from '../../../src/lib/groove.ts'
import type { Flavour, MusicMeta } from '../types.ts'
import { pitchClassOf } from './notes.ts'
import { intervalsFor } from './scales.ts'
import type { Harmony } from './harmony.ts'
import { pitchClassesOf } from './harmony.ts'

/**
 * Whether one chord is a legal member of one scale, under one convention.
 *
 * `scalePitchClasses` is in **scale order, tonic first** — the order `degree`
 * indexes into, which is why it is not the sorted order `pitchesOf` returns.
 * Callers should build it with `scaleDegreePitchClasses`; `isValidHarmony`
 * does. `chordPitchClasses` is an unordered set of 0..11 values.
 */
export type ValidityRule = (args: {
  scalePitchClasses: number[]
  chordPitchClasses: number[]
  degree: number
}) => boolean

/**
 * The scale's pitch classes in degree order, so `scale[degree]` is the pitch
 * class the chord on that degree is built on and `scale[0]` is the tonic.
 */
export function scaleDegreePitchClasses(root: Root, flavour: Flavour): number[] {
  const base = pitchClassOf(root)
  return intervalsFor(flavour).map((interval) => (base + interval) % 12)
}

/** Semitones from the tonic up to the given degree's root. */
function offsetOfDegree(scalePitchClasses: number[], degree: number): number | null {
  const rootPc = scalePitchClasses[degree]
  if (rootPc === undefined) return null
  return (((rootPc - scalePitchClasses[0]) % 12) + 12) % 12
}

/** Every chord tone is a member of `allowed`. */
function containedIn(chordPitchClasses: number[], allowed: Set<number>): boolean {
  return (
    chordPitchClasses.length > 0 &&
    chordPitchClasses.every((pc) => allowed.has(((pc % 12) + 12) % 12))
  )
}

/**
 * The modal reading: the chord belongs to the scale only if every one of its
 * tones is a scale tone. Right for the six modes, and wrong for blues — which
 * is the whole reason this module is a table and not a function.
 */
const strictDiatonic: ValidityRule = ({ scalePitchClasses, chordPitchClasses, degree }) => {
  if (offsetOfDegree(scalePitchClasses, degree) === null) return false
  return containedIn(chordPitchClasses, new Set(scalePitchClasses))
}

/** Semitones above a chord root that a dominant seventh spans. */
const DOMINANT_SEVENTH = [0, 4, 7, 10]

/**
 * The degrees blues plays dominant sevenths on, as semitones above the tonic:
 * I, IV and V. Reading them as intervals rather than as array indices keeps the
 * rule honest about the six-note blues scale, whose degree 2 is the subdominant
 * and whose degree 3 is the ♭5 passing tone.
 */
const BLUES_DOMINANT_OFFSETS = [0, 5, 7]

/**
 * Blues: strict membership, plus the full dominant seventh over I, IV and V.
 * The major third of each of those chords is outside every strict reading of
 * the blues scale, and so is the fifth of the V — but I7, IV7 and V7 are what
 * a blues *is*, so the rule admits exactly those three chords and nothing else.
 * A dominant seventh anywhere else falls back to strict membership and fails.
 */
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

/**
 * Harmonic minor: strict membership over the scale with its raised seventh,
 * which is what makes the V a dominant seventh and the vii a diminished
 * seventh. Stated explicitly rather than left to `strictDiatonic` so that the
 * leading tone is admitted by intent, not by an accident of `INTERVALS`; the
 * lowered seventh a natural-minor v7 leans on is never added, so that chord is
 * refused.
 */
const harmonicMinor: ValidityRule = ({ scalePitchClasses, chordPitchClasses, degree }) => {
  if (offsetOfDegree(scalePitchClasses, degree) === null) return false
  const allowed = new Set(scalePitchClasses)
  allowed.add((scalePitchClasses[0] + 11) % 12)
  return containedIn(chordPitchClasses, allowed)
}

/**
 * One rule per flavour the game offers. Adding a flavour means adding a row
 * here, never loosening a rule that already holds.
 */
export const VALIDITY: Record<Flavour, ValidityRule> = {
  ionian: strictDiatonic,
  aeolian: strictDiatonic,
  dorian: strictDiatonic,
  mixolydian: strictDiatonic,
  lydian: strictDiatonic,
  phrygian: strictDiatonic,
  'harmonic-minor': harmonicMinor,
  blues,
}

/** The distinct pitch classes of a set of MIDI numbers, ascending. */
function pitchClassesOfMidi(midi: number[]): number[] {
  return [...new Set(midi.map((m) => (((Math.round(m) % 12) + 12) % 12)))].sort((a, b) => a - b)
}

function sameSet(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((v, i) => v === b[i])
}

/**
 * Whether a groove's harmony is valid for the scale its metadata names.
 *
 * Two things have to hold, and both are failures of the same claim — that the
 * words shipped beside the audio describe the audio:
 *
 * 1. Every chord of the progression, on the degree it is built on, passes the
 *    rule for `music.flavour`.
 * 2. `music.chord` and `music.progression` name exactly the pitches the harmony
 *    plays, so a chord name can never drift from the notes under it.
 *
 * Returns false rather than throwing on malformed input — an unknown flavour,
 * an unparseable chord name, a progression whose names and degrees disagree —
 * so a quality gate can report an invalid groove instead of crashing on one.
 */
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
