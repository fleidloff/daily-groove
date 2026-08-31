import type { FeelTemplate } from '../types.ts'

/**
 * A medium shuffle: eighth notes swung nearly all the way to triplets.
 *
 * `swing: 0.64` is the number that makes this a shuffle rather than a lightly
 * pushed straight feel. `applySwing` delays each off-beat by `swing × half a
 * step`, so on an eighth-note grid 0.64 puts the "and" at 0.66 of the beat —
 * within a hair of the 2:1 triplet a drummer plays. Anything under about 0.4
 * reads as a straight eighth with a lean; 1.0 would collapse the off-beat onto
 * the next on-beat.
 *
 * The kit is a ride-and-hats shuffle with no cross-stick: the shuffle's
 * character is in the hand pattern, and a rim on top of it only clutters the
 * bar. The humanize bounds are the loosest of the four — a shuffle that is
 * metronomically exact stops swinging.
 *
 * `flavours` carries blues and aeolian. This is the pairing R2 is really about:
 * a shuffle is where the blues scale and the aeolian mode live, and a player
 * who hears the feel has already narrowed the answer honestly.
 */
export const shuffle: FeelTemplate = {
  id: 'shuffle',
  tempoRange: [78, 92],
  subdivision: 8,
  swing: 0.64,
  flavours: ['blues', 'aeolian'],
  voices: ['kick', 'snare', 'hatClosed', 'hatOpen', 'tomHigh', 'tomLow', 'bass', 'comp'],
  // The loosest of the four. A shuffle that is metronomically exact stops
  // swinging, so the snare lays back furthest and the hand pattern pushes.
  humanize: {
    timingMs: 16,
    velocity: 0.13,
    lean: { snare: 14, hatClosed: -4, hatOpen: -4 },
    driftDepth: 0.007,
  },
  // Bass and kick carry the weight; the comp sits back so the hand pattern
  // stays the loudest thing above the backbeat.
  gain: {
    tomHigh: -8,
    tomLow: -7,
    kick: -5,
    snare: -5,
    hatClosed: -12,
    hatOpen: -11,
    bass: -4,
    comp: -12,
  },
  // The mirror image of straight-funk's kit: hats to the left, comp to the
  // right, so two shuffles and two funks in a row do not sound like one room.
  pan: {
    tomHigh: -0.22,
    tomLow: 0.26,
    kick: 0,
    snare: 0.06,
    hatClosed: -0.32,
    hatOpen: -0.38,
    bass: 0,
    comp: 0.28,
  },
  /** Four passes: ~45 s at the 78–92 range's midpoint. */
  passes: 4,
  density: { minPerBar: 16, maxPerBar: 38 },
}
