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
 * `flavours` carries lydian and major. Both are major-third modes whose colour
 * needs air around it, and both would be swallowed by a heavier feel; they
 * differ only in the fourth, which this mix leaves audible.
 */
export const brightStraight: FeelTemplate = {
  id: 'bright-straight',
  tempoRange: [116, 132],
  subdivision: 8,
  swing: 0.06,
  flavours: ['lydian', 'major'],
  voices: ['kick', 'snare', 'hatClosed', 'rim', 'bass', 'comp'],
  humanize: { timingMs: 6, velocity: 0.05 },
  // Everything a few dB down from the funk kit, and the comp brought up: a
  // light band playing at volume rather than a heavy one playing quietly.
  gain: {
    kick: -7,
    snare: -8,
    hatClosed: -16,
    rim: -14,
    bass: -8,
    comp: -8,
  },
  pan: {
    kick: 0,
    snare: 0.08,
    hatClosed: 0.42,
    rim: -0.36,
    bass: 0,
    comp: 0.3,
  },
  density: { minPerBar: 17, maxPerBar: 40 },
}
