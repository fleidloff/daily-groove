import type { FeelTemplate } from '../types.ts'

export const swungSixteenth: FeelTemplate = {
  id: 'swung-sixteenth',
  tempoRange: [106, 116],
  subdivision: 16,
  swing: 0.44,
  flavours: ['phrygian-dominant', 'harmonic-major'],
  voices: ['kick', 'snare', 'hatClosed', 'hatOpen', 'tomHigh', 'tomLow', 'bass', 'comp'],
  humanize: {
    timingMs: 12,
    velocity: 0.12,
    lean: { snare: 11, hatClosed: -5, hatOpen: -5 },
    driftDepth: 0.008,
  },
  gain: {
    tomHigh: -11,
    tomLow: -10,
    kick: -8,
    snare: -7,
    hatClosed: -12,
    hatOpen: -18,
    bass: -1,
    comp: -2,
  },
  pan: {
    tomHigh: 0.18,
    tomLow: -0.2,
    kick: 0,
    snare: -0.03,
    hatClosed: 0.33,
    hatOpen: 0.36,
    bass: 0,
    comp: -0.31,
  },
  passes: 4,
  density: { minPerBar: 16, maxPerBar: 42 },
}
