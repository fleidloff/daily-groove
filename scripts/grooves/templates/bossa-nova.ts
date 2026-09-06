import type { FeelTemplate } from '../types.ts'

// Swing is 0.01 rather than 0 because the registry asserts every feel swings and a
// bossa does not: across 122–138 bpm on the eighth grid that displaces an off-beat
// by 1.1–1.2 ms, a quarter of the 5 ms humanize bound, so it is straight to the ear
// and still unique in the registry.
export const bossaNova: FeelTemplate = {
  id: 'bossa-nova',
  tempoRange: [122, 138],
  subdivision: 8,
  swing: 0.01,
  flavours: ['ionian', 'lydian', 'dorian', 'melodic-minor'],
  voices: ['kick', 'snare', 'hatClosed', 'rim', 'bass', 'comp'],
  humanize: {
    // The clave is the reference the rest leans around, so the rim takes no lean.
    timingMs: 5,
    velocity: 0.04,
    lean: { snare: 6, hatClosed: -2, comp: 4 },
    driftDepth: 0.003,
  },
  gain: {
    kick: -8,
    snare: -16,
    hatClosed: -13,
    rim: -9,
    bass: -4,
    comp: -8.1,
  },
  pan: {
    kick: 0,
    snare: -0.05,
    hatClosed: 0.26,
    rim: 0.16,
    bass: 0,
    comp: -0.28,
  },
  passes: 4,
  density: { minPerBar: 20, maxPerBar: 36 },
  patterns: {
    // The surdo. Every figure states beat 1 and beat 3; none states the "and" of 4,
    // which the bass approach note and the comp's anticipation already occupy.
    kick: [
      [0, 8],
      [0, 6, 8],
      [0, 8, 12],
      [0, 6, 8, 12],
    ],
    // One figure, because a bossa's hand does not vary: straight eighths, all bar.
    hatClosed: [[0, 2, 4, 6, 8, 10, 12, 14]],
    bass: [
      [0, 8],
      [0, 6, 8],
      [0, 8, 14],
    ],
    comp: [
      [0, 6, 12],
      [2, 6, 12],
      [0, 6],
      [2, 8, 12],
    ],
    snareGhosts: [
      [3, 11],
      [7, 15],
      [11, 15],
      [3, 7],
    ],
  },
  // The bossa clave, 3-2. Bar one is the son clave's 3-side; bar two displaces the
  // son clave's last stroke by an eighth, which is what makes it a bossa clave and
  // not a son clave. The 3-side leads so position zero of the file states a downbeat.
  figures: [{ voice: 'rim', bars: [[0, 6, 12], [4, 10]] }],
}
