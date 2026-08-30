import type { Root } from '../../../src/lib/groove.ts'
import type { Flavour } from '../types.ts'
import { ROOTS, pitchClassOf } from './notes.ts'
import { intervalsFor, pitchesOf } from './scales.ts'

/**
 * The octave the comp chords are voiced in. C4 = 60 sits comfortably inside the
 * pitched samples' range, and the widest chord from the highest root still lands
 * below the top sampled note.
 */
const CHORD_OCTAVE = 4

/** The en-dash the app uses between progression chords (U+2013), not a hyphen. */
const PROGRESSION_SEPARATOR = '–'

/**
 * Chord qualities, richest first. Building a chord on a scale degree means
 * taking the first quality whose every interval is already in the scale, which
 * is what guarantees an in-scale chord for a six-note blues scale as well as for
 * the seven-note modes — stacking thirds by index does not.
 *
 * The list doubles as the parser's table: a name is a root plus exactly one of
 * these suffixes, so `chordNameFor` and `pitchClassesOf` are inverses and the
 * manifest's `chord` can never name pitches the events do not play.
 */
const QUALITIES: { suffix: string; intervals: number[] }[] = [
  { suffix: 'maj7', intervals: [0, 4, 7, 11] },
  { suffix: 'm7', intervals: [0, 3, 7, 10] },
  { suffix: '7', intervals: [0, 4, 7, 10] },
  { suffix: 'mMaj7', intervals: [0, 3, 7, 11] },
  { suffix: 'm7♭5', intervals: [0, 3, 6, 10] },
  { suffix: 'dim7', intervals: [0, 3, 6, 9] },
  { suffix: 'maj7♯5', intervals: [0, 4, 8, 11] },
  { suffix: '6', intervals: [0, 4, 7, 9] },
  { suffix: 'm6', intervals: [0, 3, 7, 9] },
  { suffix: '7sus4', intervals: [0, 5, 7, 10] },
  { suffix: '', intervals: [0, 4, 7] },
  { suffix: 'm', intervals: [0, 3, 7] },
  { suffix: 'dim', intervals: [0, 3, 6] },
  { suffix: 'aug', intervals: [0, 4, 8] },
  { suffix: 'sus4', intervals: [0, 5, 7] },
  { suffix: 'sus2', intervals: [0, 2, 7] },
  { suffix: '5', intervals: [0, 7] },
]

export type Harmony = {
  /** The tonic chord, as absolute MIDI pitches. */
  chordMidi: number[]
  /** Its display name, e.g. "Cm7". */
  chordName: string
  /** Scale-degree indices, always starting at 0 (the tonic). */
  progressionDegrees: number[]
  /** Display string, chords joined with en-dashes, e.g. "Cm7–Fm7–B♭7". */
  progressionName: string
  /** One chord per progression degree, as absolute MIDI pitches. */
  progressionMidi: number[][]
}

function normalise(intervals: number[]): number[] {
  return [...new Set(intervals.map((i) => ((i % 12) + 12) % 12))].sort((a, b) => a - b)
}

/**
 * Name a chord from its root and its intervals above that root. Returns null
 * when no quality in the table matches exactly, so callers can skip a degree
 * rather than invent a name for pitches they would then have to play.
 */
export function chordNameFor(root: Root, intervals: number[]): string | null {
  const wanted = normalise(intervals)
  for (const quality of QUALITIES) {
    const candidate = normalise(quality.intervals)
    if (candidate.length === wanted.length && candidate.every((v, i) => v === wanted[i])) {
      return `${root}${quality.suffix}`
    }
  }
  return null
}

/** Split a chord name into its root and its quality suffix. */
function parseChordName(name: string): { root: Root; suffix: string } {
  const letter = name.slice(0, 1)
  const accidental = name.slice(1, 2)
  const hasAccidental = accidental === '♯' || accidental === '♭'
  const root = (hasAccidental ? name.slice(0, 2) : letter) as Root
  if (!ROOTS.includes(root)) {
    throw new Error(`pitchClassesOf: cannot parse chord name "${name}"`)
  }
  return { root, suffix: name.slice(root.length) }
}

/**
 * The pitch classes a chord name claims, ascending. The inverse of
 * `chordNameFor`: this is what lets a test assert the audio plays exactly the
 * chord the manifest names.
 */
export function pitchClassesOf(name: string): number[] {
  const { root, suffix } = parseChordName(name)
  const quality = QUALITIES.find((q) => q.suffix === suffix)
  if (!quality) {
    throw new Error(`pitchClassesOf: unknown chord quality "${suffix}" in "${name}"`)
  }
  const base = pitchClassOf(root)
  return normalise(quality.intervals.map((i) => base + i))
}

/**
 * Flavours whose harmony is not "the richest chord on each degree that the
 * scale already contains". Blues is the only one: its I, IV and V are dominant
 * sevenths whose major third no strict reading of the six-note blues scale
 * holds, so those chords have to be stated rather than derived — deriving them
 * would produce the m7 and sus4 shapes that are in the scale but are not a
 * blues. `theory/validity.ts` admits exactly these three chords for the
 * flavour, so the words and the audio still agree.
 *
 * Harmonic minor needs no entry: its raised seventh is a scale tone, so the V7
 * and the vii°7 that make the flavour recognisable fall straight out of the
 * derivation.
 *
 * `offset` is semitones above the tonic, not an index, because the blues
 * scale's degree numbering is not the diatonic one.
 */
const IDIOMS: Partial<Record<Flavour, { offset: number; intervals: number[] }[]>> = {
  blues: [
    { offset: 0, intervals: [0, 4, 7, 10] },
    { offset: 5, intervals: [0, 4, 7, 10] },
    { offset: 7, intervals: [0, 4, 7, 10] },
  ],
}

type DegreeChord = { degree: number; midi: number[]; name: string }

/**
 * Every scale degree that carries a nameable, entirely in-scale chord. Degrees
 * that do not (the ♭5 and the 5th of a blues scale, for instance) are simply
 * absent, so a progression can only ever be drawn from chords the scale
 * actually supports.
 */
function chordsForScale(root: Root, flavour: Flavour): DegreeChord[] {
  const scale = new Set(pitchesOf(root, flavour))
  const base = pitchClassOf(root)
  const degrees = intervalsFor(flavour)
  const chords: DegreeChord[] = []

  const idiom = IDIOMS[flavour]
  if (idiom) {
    for (const { offset, intervals } of idiom) {
      const degree = degrees.indexOf(offset)
      if (degree < 0) continue
      const rootPc = (base + offset) % 12
      const rootMidi = (CHORD_OCTAVE + 1) * 12 + rootPc
      const name = chordNameFor(ROOTS[rootPc], intervals)
      if (!name) continue
      chords.push({ degree, midi: intervals.map((i) => rootMidi + i), name })
    }
    return chords
  }

  degrees.forEach((offset, degree) => {
    const rootPc = (base + offset) % 12
    const rootName = ROOTS[rootPc]
    for (const quality of QUALITIES) {
      if (!quality.intervals.every((i) => scale.has((rootPc + i) % 12))) continue
      const rootMidi = (CHORD_OCTAVE + 1) * 12 + rootPc
      chords.push({
        degree,
        midi: quality.intervals.map((i) => rootMidi + i),
        name: `${rootName}${quality.suffix}`,
      })
      return
    }
  })

  return chords
}

/**
 * The harmony of one groove: a tonic chord and a short progression that starts
 * on it. Every pitch returned is a member of the scale, which is the property
 * that keeps the manifest's words honest about the audio.
 */
export function buildHarmony(root: Root, flavour: Flavour, rng: () => number): Harmony {
  const chords = chordsForScale(root, flavour)
  const tonic = chords.find((c) => c.degree === 0)
  if (!tonic) {
    throw new Error(`buildHarmony: no in-scale tonic chord for ${root} ${flavour}`)
  }

  const others = chords.filter((c) => c.degree !== 0)
  const length = others.length === 0 ? 1 : 3 + Math.floor(rng() * 2)
  const chosen: DegreeChord[] = [tonic]

  while (chosen.length < length) {
    const previous = chosen[chosen.length - 1]
    const candidates = others.filter((c) => c.degree !== previous.degree)
    const pool = candidates.length > 0 ? candidates : others
    chosen.push(pool[Math.floor(rng() * pool.length) % pool.length])
  }

  return {
    chordMidi: tonic.midi,
    chordName: tonic.name,
    progressionDegrees: chosen.map((c) => c.degree),
    progressionName: chosen.map((c) => c.name).join(PROGRESSION_SEPARATOR),
    progressionMidi: chosen.map((c) => c.midi),
  }
}
