import type { Root } from '../../../src/lib/groove.ts'
import type { Flavour } from '../types.ts'
import { ROOTS, pitchClassOf } from './notes.ts'
import { intervalsFor, pitchesOf } from './scales.ts'

const CHORD_OCTAVE = 4

const PROGRESSION_SEPARATOR = '–'

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
  chordMidi: number[]
  chordName: string
  progressionDegrees: number[]
  progressionName: string
  progressionMidi: number[][]
}

function normalise(intervals: number[]): number[] {
  return [...new Set(intervals.map((i) => ((i % 12) + 12) % 12))].sort((a, b) => a - b)
}

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

export function pitchClassesOf(name: string): number[] {
  const { root, suffix } = parseChordName(name)
  const quality = QUALITIES.find((q) => q.suffix === suffix)
  if (!quality) {
    throw new Error(`pitchClassesOf: unknown chord quality "${suffix}" in "${name}"`)
  }
  const base = pitchClassOf(root)
  return normalise(quality.intervals.map((i) => base + i))
}

const IDIOMS: Partial<Record<Flavour, { offset: number; intervals: number[] }[]>> = {
  blues: [
    { offset: 0, intervals: [0, 4, 7, 10] },
    { offset: 5, intervals: [0, 4, 7, 10] },
    { offset: 7, intervals: [0, 4, 7, 10] },
  ],
}

type DegreeChord = { degree: number; midi: number[]; name: string }

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
