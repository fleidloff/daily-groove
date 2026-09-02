import type { Groove } from '../../src/lib/groove.ts'

export type Pools = {
  scales: string[]
  chords: string[]
  progressions: string[]
}

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

function pool(used: readonly string[], distractors: readonly string[]): string[] {
  return [...new Set([...used, ...distractors])].sort()
}

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
