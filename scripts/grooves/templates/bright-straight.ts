import type { FeelTemplate } from '../types.ts'

/**
 * An up-tempo, almost-straight eighth-note feel: the lightest of the four.
 *
 * `swing: 0.06` is barely there on purpose — enough that the groove is played
 * rather than programmed, not enough to be heard as a lean. At 116–132 bpm the
 * eighth grid is the right resolution; a sixteenth grid at this tempo turns
 * every pattern into a fill.
 *
 * The kit is the lightest too: a quiet, tight hat, a cross-stick instead of an
 * open hat, and a comp mixed up level with the bass rather than under it. That
 * balance is what makes this feel read as bright rather than as straight-funk
 * played faster.
 *
 * `flavours` carries lydian and ionian. Both are major-third modes whose colour
 * needs air around it, and both would be swallowed by a heavier feel; they
 * differ only in the fourth, which this mix leaves audible.
 */
export const brightStraight: FeelTemplate = {
  id: 'bright-straight',
  tempoRange: [116, 132],
  subdivision: 8,
  swing: 0.06,
  flavours: ['lydian', 'ionian'],
  voices: ['kick', 'snare', 'hatClosed', 'hatOpen', 'rim', 'tomHigh', 'tomLow', 'bass', 'comp'],
  // The lightest lean of the four: at 116-132 bpm a large one reads as a
  // stumble rather than a feel.
  humanize: {
    timingMs: 6,
    velocity: 0.05,
    lean: { snare: 5, hatClosed: -2, rim: 3 },
    driftDepth: 0.004,
  },
  // Everything a few dB down from the funk kit, and the comp brought up: a
  // light band playing at volume rather than a heavy one playing quietly.
  gain: {
    tomHigh: -11,
    tomLow: -10,
    kick: -7,
    snare: -8,
    hatClosed: -11,
    hatOpen: -12,
    rim: -4,
    bass: -3,
    comp: -8,
  },
  pan: {
    tomHigh: 0.24,
    tomLow: -0.28,
    kick: 0,
    snare: 0.08,
    hatClosed: 0.42,
    hatOpen: 0.44,
    rim: -0.36,
    bass: 0,
    comp: 0.3,
  },
  /** Four passes: ~31 s at the 116–132 range's midpoint — the shortest of the four. */
  passes: 4,
  density: { minPerBar: 17, maxPerBar: 40 },
}
