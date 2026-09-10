import type { FeelTemplate } from '../types.ts'

export const swungSixteenth: FeelTemplate = {
  id: 'swung-sixteenth',
  tempoRange: [106, 116],
  subdivision: 16,
  swing: 0.44,
  flavours: ['phrygian-dominant', 'harmonic-major'],
  voices: ['kick', 'snare', 'hatClosed', 'ride', 'tomHigh', 'tomLow', 'bass', 'comp'],
  humanize: {
    timingMs: 12,
    velocity: 0.12,
    lean: { snare: 11, hatClosed: -5, ride: -3 },
    driftDepth: 0.008,
  },
  gain: {
    tomHigh: -11,
    tomLow: -10,
    kick: -8,
    snare: -7,
    hatClosed: -12,
    ride: -0.4,
    bass: -19.5,
    comp: -3.9,
  },
  pan: {
    tomHigh: 0.18,
    tomLow: -0.2,
    kick: 0,
    snare: -0.03,
    hatClosed: 0.33,
    ride: -0.28,
    bass: 0,
    comp: -0.31,
  },
  passes: 4,
  density: { minPerBar: 16, maxPerBar: 42 },
  bassType: 'walking-bass',
}
