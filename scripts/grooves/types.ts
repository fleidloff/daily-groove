/**
 * Frozen contracts for the groove generator.
 *
 * Every module under scripts/grooves/ builds against these, and Epics 2-4
 * extend the implementations behind them without changing the shapes. Nothing
 * here may change once the tracks start in parallel.
 */

import type { Root } from '../../src/lib/groove.ts'

/** The eight flavours the game offers, as the generator names them internally. */
export type Flavour =
  | 'ionian'
  | 'aeolian'
  | 'dorian'
  | 'mixolydian'
  | 'lydian'
  | 'phrygian'
  | 'harmonic-minor'
  | 'blues'

/**
 * `Root` is not declared here. The twelve chromatic roots are the contract the
 * generator shares with the app, so there is one declaration of them, in
 * src/lib/groove.ts, which `scripts/` reaches by relative path. Modules that
 * need it import it from there directly.
 */

export type VoiceName =
  | 'kick'
  | 'snare'
  | 'hatClosed'
  | 'hatOpen'
  | 'rim'
  | 'bass'
  | 'comp'

/** Stereo float PCM. Epic 1 renders centred; Epic 2 pans. */
export type Pcm = {
  sampleRate: number
  left: Float32Array
  right: Float32Array
}

/**
 * A feel template fixes what a human decides about a groove; the seed fixes the
 * rest. Epic 3 authors more instances; nobody changes this shape.
 */
export type FeelTemplate = {
  id: string
  tempoRange: [number, number]
  subdivision: 4 | 8 | 16
  /**
   * Off-beat displacement, 0 = straight, 1 = the off-beat lands on the next
   * on-beat. A triplet shuffle is ~0.67. Applied by Epic 2.
   */
  swing: number
  /** Epic 3 gives every template exactly two, disjoint across the set. */
  flavours: Flavour[]
  voices: VoiceName[]
  /** Deviation bounds; declared here, applied by Epic 2. */
  humanize: { timingMs: number; velocity: number }
  /** Per-voice mix level in dBFS. */
  gain: Partial<Record<VoiceName, number>>
  /** Per-voice stereo position, -1 hard left to +1 hard right. Applied by Epic 2. */
  pan: Partial<Record<VoiceName, number>>
  /**
   * Acceptable note events per bar. Epic 4's quality gate rejects a minted
   * groove outside this band — a groove too sparse to state its harmony, or so
   * dense it turns to mush.
   */
  density: { minPerBar: number; maxPerBar: number }
}

/** A groove is fully identified by these three values. */
export type GrooveSpec = {
  id: string
  template: string
  seed: number
}

export type NoteEvent = {
  voice: VoiceName
  timeSec: number
  durationSec: number
  /** 0..1 */
  velocity: number
  /** Pitched voices only. */
  midi?: number
}

/** The words that describe what the events play. */
export type MusicMeta = {
  bpm: number
  bars: number
  root: Root
  flavour: Flavour
  /** Display string, e.g. "C minor". */
  scale: string
  /** Display string, e.g. "Cm7". */
  chord: string
  /** Display string, e.g. "Cm–Fm–G7". */
  progression: string
}

/** Round-robin alternates for one velocity band. */
export type VelocityLayer = { maxVelocity: number; files: string[] }

export type PackDeclaration = {
  id: string
  sampleRate: number
  voices: Partial<
    Record<
      VoiceName,
      {
        /** Percussive voices: velocity layers, each holding round-robin alternates. */
        layers?: VelocityLayer[]
        /**
         * Pitched voices: one entry per sampled note, itself velocity-layered.
         * `midi` is the SOUNDING pitch, which is not always what the source file
         * is named - see scripts/grooves/samples/README.md.
         */
        notes?: { midi: number; layers: VelocityLayer[] }[]
      }
    >
  >
}

export type PackSample = { pcm: Pcm; rootMidi?: number }

export type SamplePack = {
  id: string
  /**
   * `velocity` and round-robin `index` are honoured from Epic 2 on; Epic 1
   * passes 1 and 0 so it always takes the top layer's first alternate.
   */
  get(
    voice: VoiceName,
    opts: { velocity: number; index: number; midi?: number },
  ): PackSample | null
  /** The declared shape, so tests can assert the pack is stocked for Epic 2. */
  describe(): PackDeclaration
}

export type Track = { voice: VoiceName; pcm: Pcm }

/** A named reason a groove or an artifact failed a check. */
export type GateFailure = { check: string; detail: string }
