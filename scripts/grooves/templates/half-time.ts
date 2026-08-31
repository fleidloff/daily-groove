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
  voices: ['kick', 'snare', 'hatClosed', 'bass', 'comp'],
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
  gain: {
    kick: -2,
    snare: -4,
    hatClosed: -18,
    bass: -5,
    comp: -13,
  },
  pan: {
    kick: 0,
    snare: -0.08,
    hatClosed: 0.28,
    bass: 0,
    comp: -0.34,
  },
  /** Two passes, not four. At 68–80 bpm four would be ~56 s and ~1.3 MB; two is ~28 s, in line with the faster feels. */
  passes: 2,
  density: { minPerBar: 14, maxPerBar: 48 },
}
