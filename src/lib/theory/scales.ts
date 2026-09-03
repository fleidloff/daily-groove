import type { Flavour, Root } from '../groove'
import { displayFlavour, type ScaleSlug } from './names.ts'
import { pitchClassOf } from './roots.ts'

export const INTERVALS: Record<ScaleSlug, number[]> = {
  ionian: [0, 2, 4, 5, 7, 9, 11],
  aeolian: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  'harmonic-minor': [0, 2, 3, 5, 7, 8, 11],
  blues: [0, 3, 5, 6, 7, 10],
  'melodic-minor': [0, 2, 3, 5, 7, 9, 11],
  'lydian-dominant': [0, 2, 4, 6, 7, 9, 10],
  'phrygian-dominant': [0, 1, 4, 5, 7, 8, 10],
  'harmonic-major': [0, 2, 4, 5, 7, 8, 11],
  locrian: [0, 1, 3, 5, 6, 8, 10],
}

export const MAJOR_INTERVALS: number[] = INTERVALS.ionian

export const FLAVOUR_INTERVALS: Record<Flavour, number[]> = Object.fromEntries(
  Object.entries(INTERVALS).map(([slug, intervals]) => [
    displayFlavour(slug as ScaleSlug),
    intervals,
  ]),
)

export function intervalsFor(flavour: ScaleSlug): number[] {
  const intervals = INTERVALS[flavour]
  if (!intervals) {
    throw new Error(`intervalsFor: unknown flavour "${flavour}"`)
  }
  return intervals
}

export function scaleName(root: Root, flavour: ScaleSlug): string {
  return `${root} ${flavour.replace(/-/g, ' ')}`
}

export function pitchesOf(root: Root, flavour: ScaleSlug): number[] {
  const base = pitchClassOf(root)
  return intervalsFor(flavour)
    .map((interval) => (base + interval) % 12)
    .sort((a, b) => a - b)
}
