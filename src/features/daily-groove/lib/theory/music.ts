import type { Answer, Flavour, Groove, Root } from '../../types'
import { buildOptions } from './options'
import { GROOVES } from '../../data/grooves.generated'
import { isoDate } from '../puzzle/selectGroove'

/** All twelve chromatic roots, in the design's order. */
export const ROOTS: Root[] = [
  'C',
  'C♯',
  'D',
  'E♭',
  'E',
  'F',
  'F♯',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
]

/**
 * A groove's answer, read from the fields the generator wrote next to the
 * audio. Never parsed back out of `scale`: that string is for display, and a
 * two-word flavour (`harmonic minor`) has no unambiguous split.
 */
export function answerOf(groove: Groove): Answer {
  return { root: groove.root, flavour: groove.flavour }
}

/**
 * The set of flavours the given grooves actually carry, deduped and sorted for
 * stability. Deriving it from the catalogue means adding a groove with a new
 * flavour widens the pool with no other edit.
 */
export function flavourPool(grooves: Groove[]): Flavour[] {
  return Array.from(new Set(grooves.map((g) => g.flavour))).sort()
}

/**
 * The day's four flavour options: the groove's own flavour plus deterministic
 * distractors from the catalogue's pool, seeded by the ISO date so every player
 * sees the same four, in the same order, all day.
 */
export function flavourOptions(date: Date, groove: Groove): Flavour[] {
  return buildOptions(groove.flavour, flavourPool(GROOVES), isoDate(date))
}

/**
 * Simple mode's six roots: the day's correct root plus five deterministic
 * distractors, seeded by the ISO date exactly as the mode row is.
 *
 * The same `buildOptions` the mode row uses, with `ROOTS` as the pool and a
 * count of six. Reusing it is the point: the six are stable for the day and
 * always contain the answer, so a groove rooted in E\u266d stays answerable — a
 * fixed six would not.
 */
export function simpleRootOptions(date: Date, answer: Answer): Root[] {
  return buildOptions(answer.root, ROOTS, isoDate(date), 6) as Root[]
}

/** Beats per bar. Every groove in the catalogue is 4/4. */
const BEATS_PER_BAR = 4

/**
 * How long the groove's loop actually lasts, in seconds, derived from the tempo
 * and bar count rather than measured off the audio file.
 *
 * The two are not the same, which is the whole reason this exists. An mp3
 * carries encoder delay at its head and padding at its tail, so
 * `HTMLAudioElement.duration` is 26–47ms longer than the music for the grooves
 * in this catalogue. Dividing that duration into four to draw bar boundaries
 * puts them in the wrong place. The tempo is the source of truth: the generator
 * rendered exactly `bars` bars at exactly `bpm`, and it wrote both into the
 * manifest.
 *
 * Returns 0 for a tempo that cannot describe a length, so callers can fall back
 * rather than divide by zero.
 */
export function loopSecondsOf(groove: Groove): number {
  if (!Number.isFinite(groove.bpm) || groove.bpm <= 0) return 0
  if (!Number.isFinite(groove.bars) || groove.bars <= 0) return 0
  return (groove.bars * BEATS_PER_BAR * 60) / groove.bpm
}
