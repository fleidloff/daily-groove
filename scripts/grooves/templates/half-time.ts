import type { FeelTemplate } from '../types.ts'

export const halfTime: FeelTemplate = {
  id: 'half-time',
  tempoRange: [68, 80],
  subdivision: 16,
  swing: 0.28,
  flavours: ['phrygian', 'harmonic-minor'],
  voices: ['kick', 'snare', 'hatClosed', 'hatOpen', 'tomHigh', 'tomLow', 'bass', 'comp'],
  humanize: {
    timingMs: 13,
    velocity: 0.11,
    lean: { snare: 15, hatClosed: -2 },
    driftDepth: 0.006,
  },
  gain: {
    tomHigh: -10,
    tomLow: -9,
    kick: -7,
    snare: -6,
    hatClosed: -13,
    hatOpen: -19,
    bass: 0,
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
  passes: 2,
  density: { minPerBar: 14, maxPerBar: 48 },
}
