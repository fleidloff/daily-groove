import type { Flavour, Root } from '../groove'
import { UnknownFlavourError, UnknownRootError } from './notes'
import { ROOTS } from './roots'
import { FLAVOUR_INTERVALS } from './scales'
import { lickFor } from './licks'

export type ScheduledNote = {
  midi: number
  offsetSeconds: number
  durationSeconds: number
}

export const LOWEST_MIDI = 60
export const HIGHEST_MIDI = 83

function intervalsOf(flavour: Flavour): number[] {
  const wanted = flavour.trim().toLowerCase()
  const key = Object.keys(FLAVOUR_INTERVALS).find((k) => k.toLowerCase() === wanted)
  if (key === undefined) throw new UnknownFlavourError(flavour)
  return FLAVOUR_INTERVALS[key]
}

export function rootMidiOf(root: Root): number {
  const index = ROOTS.indexOf(root)
  if (index < 0) throw new UnknownRootError(root)
  return LOWEST_MIDI + index
}

export function degreeSemitones(flavour: Flavour, degree: number): number {
  const intervals = intervalsOf(flavour)
  const size = intervals.length
  const step = ((degree % size) + size) % size
  const octaves = Math.floor(degree / size)
  return intervals[step] + 12 * octaves
}

export function scheduleLick(input: {
  flavour: Flavour
  root: Root
  bpm: number
  variation?: number
}): ScheduledNote[] {
  const { flavour, root, bpm, variation = 0 } = input
  const lick = lickFor(flavour, variation)
  if (lick === null) return []
  if (!Number.isFinite(bpm) || bpm <= 0) return []

  const rootMidi = rootMidiOf(root)
  const secondsPerBeat = 60 / bpm
  return lick.map((note) => ({
    midi: rootMidi + degreeSemitones(flavour, note.degree),
    offsetSeconds: note.beat * secondsPerBeat,
    durationSeconds: note.beats * secondsPerBeat,
  }))
}
