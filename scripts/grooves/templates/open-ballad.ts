import type { FeelTemplate } from '../types.ts'

export const openBallad: FeelTemplate = {
  id: 'open-ballad',
  tempoRange: [62, 74],
  subdivision: 8,
  swing: 0.02,
  flavours: ['melodic-minor', 'lydian-dominant'],
  voices: ['kick', 'snare', 'hatClosed', 'hatOpen', 'tomHigh', 'tomLow', 'bass', 'comp'],
  humanize: {
    timingMs: 11,
    velocity: 0.1,
    lean: { snare: 13, hatClosed: -2, hatOpen: -2 },
    driftDepth: 0.008,
  },
  gain: {
    tomHigh: -15,
    tomLow: -14,
    kick: -9,
    snare: -10,
    hatClosed: -15,
    hatOpen: -21,
    bass: -1,
    comp: -4,
  },
  pan: {
    tomHigh: 0.18,
    tomLow: -0.2,
    kick: 0,
    snare: -0.06,
    hatClosed: 0.2,
    hatOpen: 0.22,
    bass: 0,
    comp: -0.16,
  },
  passes: 2,
  density: { minPerBar: 8, maxPerBar: 30 },
}
