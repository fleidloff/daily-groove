/**
 * Frozen contracts for the groove generator.
 *
 * Every module under scripts/grooves/ builds against these, and Epics 2-4
 * extend the implementations behind them without changing the shapes. Nothing
 * here may change once the tracks start in parallel.
 */

import type { Root } from '../../src/lib/groove.ts'

/**
 * The twelve flavours the game offers, as the generator names them internally.
 *
 * Eight shipped first; Epic 6 added the last four, two with a major third and
 * two with a minor third, so the set stays evenly split between the families
 * the app's simple mode grades by. Ids stay hyphenated where the display is two
 * words — `scaleName` turns the hyphen into a space.
 */
export type Flavour =
  | 'ionian'
  | 'aeolian'
  | 'dorian'
  | 'mixolydian'
  | 'lydian'
  | 'phrygian'
  | 'harmonic-minor'
  | 'blues'
  | 'melodic-minor'
  | 'lydian-dominant'
  | 'phrygian-dominant'
  | 'harmonic-major'

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
  /**
   * Two toms, not three. The spec allowed for either; the library holds a high
   * and a low, and inventing a middle one by pitching a neighbour would be a
   * third tom that sounds like a detuned copy of one of these.
   */
  | 'tomHigh'
  | 'tomLow'
  /**
   * Two bongos, for the same reason there are two toms and not three: a bongo
   * IS two drums. A single `bongo` voice would be a hand drum, and the
   * interplay between the high and the low is the thing that makes the sound.
   */
  | 'bongoHigh'
  | 'bongoLow'
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
  /**
   * How the feel deviates from its own grid.
   *
   * `timingMs` and `velocity` are the bounds a single hit may wander inside.
   * `lean` is different in kind: a constant, signed millisecond offset applied
   * to every hit of a voice, which is what a listener hears as laid back or
   * pushing. It is declared per template with no shared default, because a
   * shuffle and a half-time groove do not lay back by the same amount.
   * `driftDepth` is a fractional tempo deviation across a pass, zero at both
   * ends of it.
   */
  humanize: {
    timingMs: number
    velocity: number
    /** Signed ms per voice. Negative pushes, positive lays back. */
    lean: Partial<Record<VoiceName, number>>
    /** Fractional tempo deviation, e.g. 0.006 for ±0.6 %. */
    driftDepth: number
  }
  /** Per-voice mix level in dBFS. */
  gain: Partial<Record<VoiceName, number>>
  /** Per-voice stereo position, -1 hard left to +1 hard right. Applied by Epic 2. */
  pan: Partial<Record<VoiceName, number>>
  /**
   * How many passes of the four-bar figure a groove from this feel is rendered
   * as. Always at least 2: one pass is a loop that repeats itself byte for
   * byte, which is the thing passes exist to replace. Slow feels declare fewer
   * — four passes at 68 bpm is a 56-second file.
   */
  passes: number
  /**
   * Acceptable note events per bar. Epic 4's quality gate rejects a minted
   * groove outside this band — a groove too sparse to state its harmony, or so
   * dense it turns to mush.
   */
  density: { minPerBar: number; maxPerBar: number }
}

/**
 * A groove is fully identified by `template` and `seed`; `id` names it and
 * `uuid` is its permanent identity.
 *
 * `uuid` is INPUT, not output: it is minted into catalogue.json once and copied
 * outward from there. Minting inside the renderer would make two runs of
 * `npm run grooves` disagree, and the determinism the lock depends on would go
 * with it (F12 E1 R2, R5).
 */
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
  /** 0..1 */
  velocity: number
  /** Pitched voices only. */
  midi?: number
}

/** The words that describe what the events play. */
export type MusicMeta = {
  bpm: number
  /** The musical figure: always 4. */
  bars: number
  /** What was actually rendered: `bars * template.passes`. */
  loopBars: number
  root: Root
  flavour: Flavour
  /** Display string, e.g. "C minor". */
  scale: string
  /** Display string, e.g. "Cm7". */
  chord: string
  /** Display string, e.g. "Cm–Fm–G7". */
  progression: string
  /**
   * One scale-degree index per progression chord — `Harmony.progressionDegrees`
   * verbatim. An index into `intervalsFor(flavour)`, not a diatonic degree
   * number.
   *
   * Required, not optional: every render path knows it, because `buildHarmony`
   * computed it in order to choose the chords. It sits on `MusicMeta` rather
   * than being threaded from `Harmony` so that it lands on the same side of
   * `isValidHarmony`'s boundary as `progression`, where the words can be
   * cross-checked against the audio.
   */
  progressionDegrees: number[]
}

/**
 * Round-robin alternates for one velocity band.
 *
 * `nominalVelocity` is the velocity this layer's samples were actually
 * recorded at. It defaults to the midpoint of the layer's band, and exists as
 * an override for the case where a layer's recorded level does not sit where
 * its band says. `renderVoices` scales relative to it rather than multiplying
 * by the raw velocity, which would apply the dynamics twice.
 */
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

export type PackSample = {
  pcm: Pcm
  rootMidi?: number
  /**
   * The velocity the returned layer represents, 0..1. The caller scales
   * relative to this: the layer already carries the loudness of a hit at this
   * velocity, so multiplying by the event's raw velocity on top of it would
   * square the dynamic range and put a step at every layer boundary.
   */
  nominalVelocity: number
}

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
