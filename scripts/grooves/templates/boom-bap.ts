import type { FeelTemplate } from '../types.ts'

// The kit carries no toms, which makes `withoutToms(DEFAULT_FILL)` identical to the
// fill it thins. `passes: 2` has no middle pass at all, so the loop declares one fill
// bar and no variation bar rather than two identical ones.
//
// The gain block was re-balanced after minting; the note on it says why. What still makes
// this feel is untouched — swing 0.34 against an unswung comp stab, a kick that always
// states the downbeat, and a kit whose hat sits 19 dB under its own kick, 7 dB further
// down than straight-funk's.
export const boomBap: FeelTemplate = {
  id: 'boom-bap',
  tempoRange: [86, 92],
  subdivision: 16,
  swing: 0.34,
  flavours: ['dorian', 'aeolian', 'phrygian'],
  voices: ['kick', 'snare', 'hatClosed', 'hatOpen', 'bass', 'comp'],
  humanize: {
    timingMs: 10,
    velocity: 0.07,
    lean: { snare: 12, hatClosed: -3, hatOpen: -3 },
    driftDepth: 0.004,
  },
  gain: {
    // Every kit voice sits 7 dB below where it was minted, which leaves the kit's own
    // internal balance untouched and lifts the bass and the comp 11 and 12 dB out from
    // under it. Measured post-gain track RMS relative to the kick: comp -2.6, bass -5.1
    // — straight-funk's own figures. The feel was minted at comp -15.0, bass -16.1, and
    // a listening pass on groove-71 … groove-76 rejected that: the comp states the chord
    // and the bass states the root, and this app is a puzzle about hearing which mode
    // they spell. The drum-forward inversion was the style and it loses to the game.
    kick: -11,
    snare: -10,
    hatClosed: -18,
    hatOpen: -24,
    bass: -3.1,
    comp: -4.7,
  },
  pan: {
    kick: 0,
    snare: -0.04,
    hatClosed: 0.3,
    hatOpen: 0.32,
    bass: 0,
    comp: -0.25,
  },
  passes: 2,
  density: { minPerBar: 17, maxPerBar: 33 },
  patterns: {
    // Every figure states the downbeat — that is the "boom" — and every one puts at
    // least one hit on an odd sixteenth, which swing delays behind the grid.
    kick: [
      [0, 3, 10],
      [0, 3, 8, 10],
      [0, 8, 11],
      [0, 3, 8, 11, 14],
      [0, 5, 8, 14],
    ],
    // One stab a bar, on an even step so the chord lands unswung while the kit swings
    // around it, and never on the downbeat, where it would double the kick.
    comp: [[2], [6], [8], [10]],
    // Sparser than the shared pool: one to three taps a bar, mean 1.8, so they read as
    // texture under the backbeat rather than as a second one.
    snareGhosts: [
      [3],
      [11],
      [3, 11],
      [5, 11],
      [3, 7, 11],
    ],
  },
}
