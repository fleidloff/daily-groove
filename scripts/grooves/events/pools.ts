import type { Subdivision } from '../types.ts'

export const KICK_PATTERNS: number[][] = [
  [0, 6, 10],
  [0, 3, 6, 10],
  [0, 6, 10, 14],
  [0, 7, 10],
  [0, 6, 8, 14],
]

export const HAT_PATTERNS: number[][] = [
  [0, 2, 4, 6, 8, 10, 12, 14],
  [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
  [0, 2, 3, 4, 6, 8, 10, 11, 12, 14],
]

// A riding feel's hat is the left foot under the ride, so every figure holds
// beats 2 and 4; the second picks up the "and" of 4 that hatOpen vacated.
export const HAT_PUNCTUATION_PATTERNS: number[][] = [
  [4, 12],
  [4, 12, 14],
  [0, 4, 8, 12],
]

// On a riding feel the ride is the pulse, so every figure keeps every quarter
// and outnumbers the busiest foot hat.
export const RIDE_PATTERNS: Partial<Record<Subdivision, number[][]>> = {
  8: [
    [0, 2, 4, 6, 8, 10, 12, 14],
    [0, 4, 6, 8, 12, 14],
    [0, 4, 6, 8, 12],
  ],
  // At swing 0.44 applySwing delays the odd sixteenths, so a step on 3, 7, 11
  // or 15 is the "a" of its beat — a late flick, not the shuffle's triplet ping.
  //
  // Signed off 2026-09-05: Fred heard six renders of groove-40 and said "5 sounds
  // best, go with the proposal" — cell 5, the 6-hit member below. A listening pass,
  // not a measurement. The 8-hit member it replaces was heard first and rejected
  // ("in groove 40, the ride is too loud. It get's a bit too much"). The members
  // differ by where the flick lands rather than by how many there are, because this
  // feel's bar is 25-35 % shorter than the shuffle's and the count that matters is
  // per second, not per bar.
  16: [
    [0, 3, 4, 8, 11, 12],
    [0, 4, 7, 8, 12, 15],
    [0, 4, 8, 12, 15],
  ],
}

export const RIDE_SUSTAIN_SIXTEENTHS = 8

export const BASS_PATTERNS: number[][] = [
  [0, 6, 10],
  [0, 3, 10],
  [0, 6, 10, 14],
  [0, 8, 14],
]

export const SNARE_GHOST_PATTERNS: number[][] = [
  [3, 11],
  [7, 15],
  [11, 15],
  [3, 7, 11],
  [3, 11, 15],
]

export const BONGO_PATTERNS: { high: number[]; low: number[] }[] = [
  { high: [3, 11], low: [6] },
  { high: [7, 15], low: [2, 10] },
  { high: [3, 7, 13], low: [10] },
  { high: [11], low: [3, 14] },
]

export const COMP_PATTERNS: number[][] = [
  [2, 10],
  [2, 6, 10],
  [0, 10],
  [2, 11],
]
