import type { Groove } from '../../src/lib/groove.ts'

/**
 * The three distractor pools the generated module exports. They exist so the
 * app's `buildOptions` can fill a four-option set for any groove: the correct
 * value plus three plausible wrong ones.
 *
 * They are derived, never hand-maintained — the union of what the catalogue
 * actually uses and a fixed vocabulary of plausible alternatives. Deriving the
 * first half is what stops a pool drifting away from the answers it is meant
 * to hide.
 */
export type Pools = {
  scales: string[]
  chords: string[]
  progressions: string[]
}

/**
 * Plausible scales the catalogue does not use — spread across the twelve roots
 * and the twelve flavours the game offers, in the same notation the renderer
 * emits (Unicode accidentals, lower-case flavour), with at least two roots per
 * flavour so a set never has to reuse one.
 *
 * Epic 4 (feature-7) spelled these modally: `A major` and `C minor` became
 * `A ionian` and `C aeolian`. These are display strings rather than `Flavour`
 * values, so the union rename could not reach them and nothing failed to
 * compile — but a pool whose real answers read `B ionian` and whose distractors
 * read `A major` hands the player the answer by its spelling alone.
 */
const SCALE_DISTRACTORS = [
  'A aeolian',
  'A dorian',
  'A ionian',
  'A phrygian dominant',
  'A♭ lydian',
  'A♭ melodic minor',
  'B aeolian',
  'B blues',
  'B melodic minor',
  'B♭ lydian',
  'B♭ lydian dominant',
  'B♭ mixolydian',
  'C aeolian',
  'C ionian',
  'C mixolydian',
  'C♯ harmonic major',
  'C♯ phrygian',
  'D dorian',
  'D harmonic minor',
  'D ionian',
  'D phrygian dominant',
  'E blues',
  'E lydian dominant',
  'E♭ ionian',
  'F aeolian',
  'F harmonic major',
  'F lydian',
  'F♯ dorian',
  'F♯ harmonic minor',
  'G ionian',
  'G mixolydian',
  'G phrygian',
] as const

/** Plausible chord symbols the catalogue does not use. */
const CHORD_DISTRACTORS = [
  'A7',
  'A♭maj7',
  'Am7',
  'Amaj7',
  'B♭7',
  'B♭maj7',
  'Bm7♭5',
  'Cm7♭5',
  'Cmaj7',
  'C♯m7♭5',
  'D7',
  'Dm7',
  'Dmaj7',
  'E7',
  'Em',
  'E♭m6',
  'E♭maj7',
  'F♯7',
  'F♯m7',
  'Fm7',
  'Fmaj7',
  'G7',
  'G♯dim7',
  'Gmaj7',
] as const

/** Plausible progressions the catalogue does not use. */
const PROGRESSION_DISTRACTORS = [
  'A♭maj7–Fm7–B♭m7–E♭7',
  'Am–Dm–E7',
  'Am7–D7–Gmaj7',
  'Am7–Fmaj7–Cmaj7–G',
  'B♭maj7–Gm7–Cm7–F7',
  'Bm7–Em7–Amaj7',
  'Bm7♭5–E7–Am7',
  'C–Am–F–G',
  'Cm7–Fm7–G7',
  'Cmaj7–Am7–Dm7–G7',
  'C♯m7–F♯m7–G♯7',
  'D–G–A',
  'Dm–B♭–C',
  'Dm7–G7–Cmaj7',
  'E7–A7–B7',
  'Em–Am–B7',
  'Em7–A7–Dmaj7',
  'E♭maj7–Cm7–Fm7–B♭7',
  'F–C–G–Am',
  'Fmaj7–Em7–Dm7–Cmaj7',
  'F♯m7–B7–Emaj7',
  'G7–C7–D7',
  'Gm7–C7–Fmaj7',
  'Gmaj7–Em7–Am7–D7',
] as const

/**
 * One pool: everything used, plus the fixed vocabulary, deduped and sorted by
 * code unit. Sorting (rather than localeCompare) keeps the rendered module
 * byte-identical on every machine, so a re-render is a no-op diff.
 */
function pool(used: readonly string[], distractors: readonly string[]): string[] {
  return [...new Set([...used, ...distractors])].sort()
}

/**
 * The three pools for a catalogue. Each contains every value its entries use —
 * so the correct answer is always in its own pool — plus at least four values
 * they do not, which is what guarantees `buildOptions` can always fill four
 * options.
 */
export function buildPools(entries: readonly Groove[]): Pools {
  return {
    scales: pool(
      entries.map((e) => e.scale),
      SCALE_DISTRACTORS,
    ),
    chords: pool(
      entries.map((e) => e.chord),
      CHORD_DISTRACTORS,
    ),
    progressions: pool(
      entries.map((e) => e.progression),
      PROGRESSION_DISTRACTORS,
    ),
  }
}
