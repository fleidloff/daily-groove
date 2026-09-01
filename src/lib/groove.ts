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
  /**
   * The groove's permanent identity: a canonical lowercase v4 uuid, minted once
   * into `scripts/grooves/catalogue.json` and copied outward by the manifest
   * generator, which never mints one of its own.
   *
   * It is the only identifier a share link carries, and it is carried whole —
   * there is no short form and no second shareable id. `id` stays the catalogue
   * key and the mp3 filename; this survives a renumbering, a rename or a
   * re-render of the audio, because links already in the wild point at it.
   */
  uuid: string
  audioSrc: string // URL under /grooves, e.g. "/grooves/groove-01.mp3"
  name: string // display name shown on the groove card, e.g. "Sunroom Shuffle"
  bpm: number // display only; does not drive playback or the progress bar
  scale: string // absolute, e.g. "C minor"
  chord: string // absolute, e.g. "Dmaj7"
  progression: string // absolute, e.g. "Dm–G–C"
  /**
   * One scale-degree index per progression chord, in the same order — an index
   * into the flavour's interval table, always starting at 0 (the tonic). What
   * `scripts/grooves/theory/harmony.ts` computed when it chose the chords, so
   * the app never parses a chord symbol back into a degree.
   *
   * Optional, as `loopBars` is: a manifest written before the field existed
   * still describes a groove, and where the degrees are missing the numerals
   * are missing and the bars are not.
   */
  progressionDegrees?: number[]
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
