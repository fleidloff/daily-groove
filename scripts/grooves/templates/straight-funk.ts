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
  voices: ['kick', 'snare', 'hatClosed', 'hatOpen', 'rim', 'bass', 'comp'],
  humanize: { timingMs: 9, velocity: 0.09 },
  gain: {
    kick: -3,
    snare: -6,
    hatClosed: -14,
    hatOpen: -15,
    rim: -17,
    bass: -6,
    comp: -11,
  },
  // Kick, snare and bass hold the centre; the cymbals and the comp open the
  // image out either side, the way a kit sits from behind.
  pan: {
    kick: 0,
    snare: -0.05,
    hatClosed: 0.35,
    hatOpen: 0.4,
    rim: -0.3,
    bass: 0,
    comp: -0.2,
  },
  density: { minPerBar: 18, maxPerBar: 44 },
}
