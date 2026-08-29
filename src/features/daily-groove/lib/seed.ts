import type { Groove } from '../types'

/**
 * Bundled seed set of grooves. Audio files are served from public/grooves/ and
 * referenced by the audioSrc URL contract. Scales, chords and progressions are
 * absolute values (root + quality).
 */
export const GROOVES: Groove[] = [
  {
    id: 'groove-01',
    audioSrc: '/grooves/groove-01.mp3',
    name: 'Cellar Light',
    bpm: 76,
    scale: 'C minor',
    chord: 'Cm7',
    progression: 'Cm–Fm–G7',
  },
  {
    id: 'groove-02',
    audioSrc: '/grooves/groove-02.mp3',
    name: 'Riverbend Vamp',
    bpm: 96,
    scale: 'A dorian',
    chord: 'Am7',
    progression: 'Am7–D7–Am7',
  },
  {
    id: 'groove-03',
    audioSrc: '/grooves/groove-03.mp3',
    name: 'Midnight Andaluz',
    bpm: 92,
    scale: 'E phrygian',
    chord: 'Em',
    progression: 'Em–Am–B7',
  },
  {
    id: 'groove-04',
    audioSrc: '/grooves/groove-04.mp3',
    name: 'Porch Light Boogie',
    bpm: 112,
    scale: 'G mixolydian',
    chord: 'G7',
    progression: 'G7–C–D7',
  },
  {
    id: 'groove-05',
    audioSrc: '/grooves/groove-05.mp3',
    name: 'Wide Open Morning',
    bpm: 118,
    scale: 'D major',
    chord: 'Dmaj7',
    progression: 'D–G–A',
  },
  {
    id: 'groove-06',
    audioSrc: '/grooves/groove-06.mp3',
    name: 'Cloudbank Drift',
    bpm: 68,
    scale: 'F lydian',
    chord: 'Fmaj7',
    progression: 'Fmaj7–G–C',
  },
  {
    id: 'groove-07',
    audioSrc: '/grooves/groove-07.mp3',
    name: 'Vertigo Steps',
    bpm: 138,
    scale: 'B locrian',
    chord: 'Bm7b5',
    progression: 'Bm7b5–E7–Am',
  },
]

/**
 * Distractor pool of absolute scale values. Includes every scale used in
 * GROOVES plus additional plausible distractors so the picker always has enough
 * options for any groove.
 */
export const SCALE_POOL: string[] = [
  'C minor',
  'A dorian',
  'E phrygian',
  'G mixolydian',
  'D major',
  'F lydian',
  'B locrian',
  'A minor',
  'C major',
  'D dorian',
  'E minor',
  'G major',
  'F# minor',
  'Bb major',
  'C# phrygian',
  'A mixolydian',
]

/**
 * Distractor pool of absolute chord values. Includes every chord used in
 * GROOVES plus additional plausible distractors so the picker always has enough
 * options for any groove.
 */
export const CHORD_POOL: string[] = [
  'Cm7',
  'Am7',
  'Em',
  'G7',
  'Dmaj7',
  'Fmaj7',
  'Bm7b5',
  'A7',
  'Cmaj7',
  'Dm7',
  'E7',
  'Gmaj7',
  'Bb7',
  'F#m7',
]

/**
 * Distractor pool of absolute chord-progression values. Includes every
 * progression used in GROOVES plus additional plausible distractors so the
 * picker always has enough options for any groove.
 */
export const PROGRESSION_POOL: string[] = [
  'Cm–Fm–G7',
  'Am7–D7–Am7',
  'Em–Am–B7',
  'G7–C–D7',
  'D–G–A',
  'Fmaj7–G–C',
  'Bm7b5–E7–Am',
  'Am–Dm–E7',
  'C–Am–F–G',
  'Dm–G–C',
  'Em7–A7–Dmaj7',
  'F–C–G–Am',
]
