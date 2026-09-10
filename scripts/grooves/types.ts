import type { Root } from '../../src/lib/groove.ts'
import type { FlavourSlug as Flavour } from '../../src/lib/theory/names.ts'
export type { FlavourSlug as Flavour } from '../../src/lib/theory/names.ts'

export const VOICE_NAMES = [
  'kick',
  'snare',
  'hatClosed',
  'hatOpen',
  'ride',
  'rideBell',
  'rim',
  'tomHigh',
  'tomLow',
  'bongoHigh',
  'bongoLow',
  'claves',
  'cowbell',
  'bass',
  'comp',
] as const

export type VoiceName = (typeof VOICE_NAMES)[number]

export type Pcm = {
  sampleRate: number
  left: Float32Array
  right: Float32Array
}

export type Subdivision = 4 | 8 | 16

export type BongoFigure = { high: number[]; low: number[] }

// The snare line a style plays instead of a backbeat, and the tom accents that
// travel with it.
export type KitFigure = { snare: number[]; tomHigh?: number[]; tomLow?: number[] }

export type PatternPools = {
  kick?: number[][]
  hatClosed?: number[][]
  ride?: Partial<Record<Subdivision, number[][]>>
  bass?: number[][]
  comp?: number[][]
  bongos?: BongoFigure[]
  snareGhosts?: number[][]
  kit?: KitFigure[]
}

export type FixedFigure = {
  voice: VoiceName
  bars: number[][]
}

export type BassType = 'normal' | 'walking-bass'

export type FeelTemplate = {
  id: string
  tempoRange: [number, number]
  subdivision: Subdivision
  swing: number
  flavours: Flavour[]
  voices: VoiceName[]
  humanize: {
    timingMs: number
    velocity: number
    lean: Partial<Record<VoiceName, number>>
    driftDepth: number
  }
  gain: Partial<Record<VoiceName, number>>
  pan: Partial<Record<VoiceName, number>>
  passes: number
  density: { minPerBar: number; maxPerBar: number }
  patterns?: PatternPools
  figures?: FixedFigure[]
  bassType?: BassType
  bassSustain?: number
}

export type GrooveSpec = {
  id: string
  uuid: string
  template: string
  seed: number
  bassType?: BassType
}

export type NoteEvent = {
  voice: VoiceName
  timeSec: number
  durationSec: number
  velocity: number
  midi?: number
}

export type MusicMeta = {
  bpm: number
  bars: number
  loopBars: number
  root: Root
  flavour: Flavour
  scale: string
  chord: string
  progression: string
  progressionDegrees: number[]
}

export type VelocityLayer = {
  maxVelocity: number
  files: string[]
  nominalVelocity?: number
}

export type PackDeclaration = {
  id: string
  sampleRate: number
  voices: Partial<
    Record<
      VoiceName,
      {
        layers?: VelocityLayer[]
        notes?: { midi: number; layers: VelocityLayer[] }[]
      }
    >
  >
}

export type PackSample = {
  pcm: Pcm
  rootMidi?: number
  nominalVelocity: number
}

export type SamplePack = {
  id: string
  get(
    voice: VoiceName,
    opts: { velocity: number; index: number; midi?: number },
  ): PackSample | null
  describe(): PackDeclaration
}

export type Track = { voice: VoiceName; pcm: Pcm }

export type GateFailure = { check: string; detail: string }
