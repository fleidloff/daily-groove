import type { FeelTemplate } from '../types.ts'

/**
 * A slow half-time feel: a sixteenth grid at half the pulse.
 *
 * The tempo range is the lowest of the four, and the backbeat is the widest —
 * one snare on beat three instead of two on two and four. `events.ts` places
 * that (see PLACEMENTS there); a template has no field for it, and inventing
 * one would have meant editing the frozen `FeelTemplate`.
 *
 * The kit is the sparsest: no open hat and no cross-stick, because half-time
 * lives on the space between the kick and the snare, and anything filling the
 * second half of the bar takes that space away. The swing is moderate: the
 * sixteenths lean, which is what keeps a slow groove from dragging.
 *
 * `flavours` carries phrygian and harmonic minor. Both are the dark end of the
 * eight, both want a slow tempo to let their one distinctive interval — the ♭2
 * and the raised seventh — be heard, and neither survives at 130 bpm.
 */
export const halfTime: FeelTemplate = {
  id: 'half-time',
  tempoRange: [68, 80],
  subdivision: 16,
  swing: 0.28,
  flavours: ['phrygian', 'harmonic-minor'],
  voices: ['kick', 'snare', 'hatClosed', 'hatOpen', 'tomHigh', 'tomLow', 'bass', 'comp'],
  // Half-time lives on the space between the kick and the snare, so the snare
  // is the latest of any template - it is the whole character of the feel.
  humanize: {
    timingMs: 13,
    velocity: 0.11,
    lean: { snare: 15, hatClosed: -2 },
    driftDepth: 0.006,
  },
  // Kick and snare are the loudest of any template and the hat the quietest:
  // in half-time the two big hits are the groove, and the hat is a timekeeper
  // nobody should be listening to.
  // Corrected for the MuldjordKit drums. The delta is per voice and identical
  // across all six templates, because the thing that changed is the pack's
  // recorded levels, not this feel's intent: MuldjordKit's snare and hats sit
  // at different levels from VCSL's, and every template inherits that equally.
  // Re-deriving each template independently would have quietly rewritten five
  // balances that were already right relative to each other.
  gain: {
    tomHigh: -10,
    tomLow: -9,
    kick: -7,
    snare: -6,
    hatClosed: -13,
    hatOpen: -19,
    bass: 0,
    // Raised to bring the comp within a few dB of the drum bus. This feel
    // inherited a comp level from when the kit was a cajon, which left the keys
    // 8-12 dB under the drums — and the game is to name the chord, so the voice
    // carrying the chord cannot be the quietest thing in the mix. `open-ballad`
    // has always been balanced this way on purpose; this brings the rest of the
    // set to the same principle rather than leaving it as one feel's exception.
    comp: -3,
  },
  pan: {
    tomHigh: 0.2,
    tomLow: -0.24,
    kick: 0,
    snare: -0.08,
    hatClosed: 0.28,
    hatOpen: 0.3,
    bass: 0,
    comp: -0.34,
  },
  /** Two passes, not four. At 68–80 bpm four would be ~56 s and ~1.3 MB; two is ~28 s, in line with the faster feels. */
  passes: 2,
  density: { minPerBar: 14, maxPerBar: 48 },
}
