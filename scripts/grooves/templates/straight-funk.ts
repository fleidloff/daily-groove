import type { FeelTemplate } from '../types.ts'

/**
 * A mid-tempo sixteenth-note funk.
 *
 * Epic 1 declared `swing` and `humanize` at zero; Epic 2 turns them up. The
 * swing is a light sixteenth-note push rather than a shuffle — enough that the
 * off-beats lean, not so much that the groove stops being straight funk — and
 * the humanize bounds are a player's slop, a few milliseconds and a few percent
 * of velocity. These three numbers are the tuning knobs the listening sign-off
 * (R18) turns; nothing about the code changes when they do.
 *
 * `flavours` carries dorian and mixolydian: the two modes a sixteenth-note funk
 * is actually written in. Both have the flat seventh the style lives on, and
 * they differ only in the third, which is exactly the distinction a player
 * should be listening for over this feel. Epic 1's stopgap — all eight flavours
 * on the one template that existed — is retired here (R2, AC15).
 */
export const straightFunk: FeelTemplate = {
  id: 'straight-funk',
  tempoRange: [94, 106],
  subdivision: 16,
  swing: 0.18,
  flavours: ['dorian', 'mixolydian'],
  voices: ['kick', 'snare', 'hatClosed', 'hatOpen', 'rim', 'tomHigh', 'tomLow', 'bass', 'comp'],
  // A funk snare sits a touch behind the kick and the hats push; the rim is a
  // pickup and can afford to be late.
  humanize: {
    timingMs: 9,
    velocity: 0.09,
    lean: { snare: 9, hatClosed: -3, hatOpen: -3, rim: 4 },
    driftDepth: 0.005,
  },
  // Re-derived for the MuldjordKit drums rather than carried over from the
  // cajon. Each figure is a target level minus that voice's own measured RMS at
  // unity (see the levelling section of samples/README.md), so the numbers say
  // where a voice sits in the mix and the pack says how loud its recording is.
  // The old kit's gains compensated for a cajon with almost no low end; a real
  // bass drum needs the opposite correction, which is why nothing here is the
  // old number shifted by a constant.
  gain: {
    tomHigh: -13,
    tomLow: -12,
    kick: -8,
    snare: -8,
    hatClosed: -9,
    hatOpen: -16,
    rim: -11,
    bass: -1,
    // Raised to bring the comp within a few dB of the drum bus. This feel
    // inherited a comp level from when the kit was a cajon, which left the keys
    // 8-12 dB under the drums — and the game is to name the chord, so the voice
    // carrying the chord cannot be the quietest thing in the mix. `open-ballad`
    // has always been balanced this way on purpose; this brings the rest of the
    // set to the same principle rather than leaving it as one feel's exception.
    comp: -3,
  },
  // Kick, snare and bass hold the centre; the cymbals and the comp open the
  // image out either side, the way a kit sits from behind.
  pan: {
    tomHigh: 0.22,
    tomLow: -0.26,
    kick: 0,
    snare: -0.05,
    hatClosed: 0.35,
    hatOpen: 0.4,
    rim: -0.3,
    bass: 0,
    comp: -0.2,
  },
  /** Four passes of four bars: ~38 s at the 94–106 range's midpoint. */
  passes: 4,
  density: { minPerBar: 18, maxPerBar: 44 },
}
