/**
 * The contract between the groove generator and the app.
 *
 * `Groove` is what `scripts/grooves/` produces and what the app consumes, so it
 * lives here rather than inside the feature: both halves of the system own it
 * jointly, and neither can move it without the other noticing. `Root` and
 * `Flavour` come with it because `Groove` is defined in terms of them.
 *
 * This module is a leaf. It imports nothing — not even through the `@/` alias —
 * because the generator reaches it by relative path from outside `src/`, where
 * Node's type stripping resolves no alias.
 *
 * Gameplay and persistence types (`Answer`, `Attempt`, `DailyResult`) stay in
 * `src/features/daily-groove/types.ts`; the generator has never heard of them.
 */

/** The twelve chromatic roots, in the design's order. */
export type Root =
  | 'C'
  | 'C♯'
  | 'D'
  | 'E♭'
  | 'E'
  | 'F'
  | 'F♯'
  | 'G'
  | 'A♭'
  | 'A'
  | 'B♭'
  | 'B'

/**
 * A scale flavour as displayed, e.g. 'Dorian'. A plain string rather than a
 * union: the pool is derived from the seed data at runtime, so a union would
 * have to be regenerated whenever a groove is added.
 */
export type Flavour = string

export type Groove = {
  id: string
  audioSrc: string // URL under /grooves, e.g. "/grooves/groove-01.mp3"
  name: string // display name shown on the groove card, e.g. "Sunroom Shuffle"
  bpm: number // display only; does not drive playback or the progress bar
  scale: string // absolute, e.g. "C minor"
  chord: string // absolute, e.g. "Dmaj7"
  progression: string // absolute, e.g. "Dm–G–C"
  /**
   * The answer, carried as its own fields rather than parsed back out of
   * `scale`. The generator knows both because it rendered them, and a parsed
   * string is a second source of truth waiting to disagree with the first.
   */
  root: Root
  flavour: Flavour
  bars: number // the musical figure, always 4
  /**
   * The file's loop: `bars` times the feel's pass count, so 16 for a four-pass
   * groove and 8 for a two-pass one. Optional so a manifest written before the
   * field existed still describes a groove; `loopSecondsOf` falls back to
   * `bars`.
   */
  loopBars?: number
  /**
   * Seconds of encoder delay at the head of this file, measured from the mp3
   * itself at mint time. The music begins here, not at 0.
   */
  headDelaySeconds: number
}
