import type { Flavour, Root } from '../../types'
import { FLAVOUR_INTERVALS, UnknownFlavourError, UnknownRootError } from './notes'
import { ROOTS } from './music'
import { lickFor } from './licks'

/**
 * One note of a lick, resolved against a root and a tempo — what the voice
 * schedules and the last thing in this feature that knows about degrees.
 */
export type ScheduledNote = {
  /** 60..83 — a pitch the manifest has a file for. */
  midi: number
  /** Onset in seconds from the start of the phrase. The first note is 0. */
  offsetSeconds: number
  durationSeconds: number
}

/**
 * The lowest and highest pitch the render provides: C4 to B5.
 *
 * The reference notes occupy the lower octave, so a root sits at 60–71 and a
 * phrase may reach one octave above it — B4 plus an octave is B5, the top of
 * the range. That is the whole reason the render widened, and it is why a lick
 * declares no degree above the octave.
 */
export const LOWEST_MIDI = 60
export const HIGHEST_MIDI = 83

/** Match a flavour to its table entry, ignoring case, as `notes.ts` does. */
function intervalsOf(flavour: Flavour): number[] {
  const wanted = flavour.trim().toLowerCase()
  const key = Object.keys(FLAVOUR_INTERVALS).find((k) => k.toLowerCase() === wanted)
  if (key === undefined) throw new UnknownFlavourError(flavour)
  return FLAVOUR_INTERVALS[key]
}

/**
 * The root in the reference octave: 60..71, the same twelve pitches the root
 * row already sounds, in `ROOTS` order.
 */
export function rootMidiOf(root: Root): number {
  const index = ROOTS.indexOf(root)
  if (index < 0) throw new UnknownRootError(root)
  return LOWEST_MIDI + index
}

/**
 * Semitones above the root for a degree index, wrapping the scale into octaves.
 *
 * The wrap is what lets one written phrase declare `degree: 7` and mean the
 * root an octave up in every mode, including the six-note blues scale, where
 * the octave is degree 6.
 */
export function degreeSemitones(flavour: Flavour, degree: number): number {
  const intervals = intervalsOf(flavour)
  const size = intervals.length
  // Floored division on both halves, so a degree below the root resolves into
  // the octave under it rather than off the end of the array.
  const step = ((degree % size) + size) % size
  const octaves = Math.floor(degree / size)
  return intervals[step] + 12 * octaves
}

/**
 * A mode, a root and a tempo become the notes to schedule.
 *
 * `[]` rather than a throw for a mode with no lick or a tempo that makes no
 * sense: this is reached from a click handler after the chip has been selected,
 * and a mode the app cannot play must be silence (R19, R20).
 */
export function scheduleLick(input: {
  flavour: Flavour
  root: Root
  bpm: number
}): ScheduledNote[] {
  const { flavour, root, bpm } = input
  const lick = lickFor(flavour)
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
