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
 * The kit is hats and no cross-stick: the shuffle's character is in the hand
 * pattern, and a rim on top of it only clutters the bar. A ride was tried here
 * in feature-13 and taken out again — the only kit available was a rock kit and
 * its ride sounded like one, where a shuffle wants a jazz ride. The hats keep
 * the time until that cymbal exists. The humanize bounds are the loosest of the four — a shuffle that is
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
  // Corrected for the MuldjordKit drums. The delta is per voice and identical
  // across all six templates, because the thing that changed is the pack's
  // recorded levels, not this feel's intent: MuldjordKit's snare and hats sit
  // at different levels from VCSL's, and every template inherits that equally.
  // Re-deriving each template independently would have quietly rewritten five
  // balances that were already right relative to each other.
  gain: {
    tomHigh: -12,
    tomLow: -11,
    kick: -10,
    snare: -7,
    hatClosed: -7,
    hatOpen: -12,
    bass: 1,
    // Raised to bring the comp within a few dB of the drum bus. This feel
    // inherited a comp level from when the kit was a cajon, which left the keys
    // 8-12 dB under the drums — and the game is to name the chord, so the voice
    // carrying the chord cannot be the quietest thing in the mix. `open-ballad`
    // has always been balanced this way on purpose; this brings the rest of the
    // set to the same principle rather than leaving it as one feel's exception.
    comp: -4,
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
