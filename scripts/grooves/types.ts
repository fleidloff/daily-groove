import type { Root } from '../../src/lib/groove.ts'
import type { FlavourSlug as Flavour } from '../../src/lib/theory/names.ts'
export type { FlavourSlug as Flavour } from '../../src/lib/theory/names.ts'

export type VoiceName =
  | 'kick'
  | 'snare'
  | 'hatClosed'
  | 'hatOpen'
  | 'rim'
  | 'tomHigh'
  | 'tomLow'
  | 'bongoHigh'
  | 'bongoLow'
  | 'bass'
  | 'comp'

export type Pcm = {
  sampleRate: number
  left: Float32Array
  right: Float32Array
}

export type FeelTemplate = {
  id: string
  tempoRange: [number, number]
  subdivision: 4 | 8 | 16
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
}

export type GrooveSpec = {
  id: string
  uuid: string
  template: string
  seed: number
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
