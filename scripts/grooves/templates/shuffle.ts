import type { FeelTemplate } from '../types.ts'

export const shuffle: FeelTemplate = {
  id: 'shuffle',
  tempoRange: [78, 92],
  subdivision: 8,
  swing: 0.64,
  flavours: ['blues', 'aeolian'],
  voices: ['kick', 'snare', 'hatClosed', 'hatOpen', 'tomHigh', 'tomLow', 'bass', 'comp'],
  humanize: {
    timingMs: 16,
    velocity: 0.13,
    lean: { snare: 14, hatClosed: -4, hatOpen: -4 },
    driftDepth: 0.007,
  },
  gain: {
    tomHigh: -12,
    tomLow: -11,
    kick: -10,
    snare: -7,
    hatClosed: -7,
    hatOpen: -12,
    bass: 1,
    comp: -4,
  },
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
  passes: 4,
  density: { minPerBar: 16, maxPerBar: 38 },
}
