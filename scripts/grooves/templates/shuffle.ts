import type { FeelTemplate } from '../types.ts'

export const shuffle: FeelTemplate = {
  id: 'shuffle',
  tempoRange: [78, 92],
  subdivision: 8,
  swing: 0.64,
  flavours: ['blues', 'aeolian'],
  voices: ['kick', 'snare', 'hatClosed', 'ride', 'tomHigh', 'tomLow', 'bass', 'comp'],
  humanize: {
    timingMs: 16,
    velocity: 0.13,
    lean: { snare: 14, hatClosed: -4, ride: -2 },
    driftDepth: 0.007,
  },
  gain: {
    tomHigh: -12,
    tomLow: -11,
    kick: -10,
    snare: -7,
    hatClosed: -7,
    ride: -0.93,
    bass: -19,
    comp: -5.9,
  },
  pan: {
    tomHigh: -0.22,
    tomLow: 0.26,
    kick: 0,
    snare: 0.06,
    hatClosed: -0.32,
    ride: 0.3,
    bass: 0,
    comp: 0.28,
  },
  passes: 4,
  density: { minPerBar: 16, maxPerBar: 38 },
}
