/**
 * A sample pack with no samples on disk.
 *
 * Every buffer is synthesized in memory - a short noise burst under an envelope
 * for the percussive voices, a decaying sine for the pitched ones - so the
 * pipeline is testable without binary fixtures and without an ffmpeg subprocess
 * per note. It satisfies the same `SamplePack` interface as the real pack, which
 * is the whole point: the renderer needs no branch for it.
 *
 * It is a test artifact. Nothing rendered from it is ever committed.
 */

import type {
  PackDeclaration,
  PackSample,
  Pcm,
  SamplePack,
  VelocityLayer,
  VoiceName,
} from '../types.ts'

const DEFAULT_SAMPLE_RATE = 44100

const PERCUSSIVE: VoiceName[] = ['kick', 'snare', 'hatClosed', 'hatOpen', 'rim']
const PITCHED: VoiceName[] = ['bass', 'comp']

/** Seconds of decay, per percussive voice. */
const DECAY: Record<string, number> = {
  kick: 0.3,
  snare: 0.22,
  hatClosed: 0.06,
  hatOpen: 0.32,
  rim: 0.08,
}

/** Sampled notes per pitched voice, every four semitones, as the real pack is. */
const NOTES: Record<string, number[]> = {
  bass: [28, 32, 36, 40, 44, 48],
  comp: [48, 52, 56, 60, 64, 68, 72],
}

export type PlaceholderPackOptions = {
  id?: string
  sampleRate?: number
  /** Which voices the pack declares. Defaults to all seven. */
  voices?: VoiceName[]
  /** Velocity layers per voice. Epic 1 only ever reaches the top one. */
  layers?: number
  /** Round-robin alternates per layer. Epic 1 only ever reaches the first. */
  roundRobins?: number
  /** Sampled notes per pitched voice, to force a transposition in a test. */
  notes?: Partial<Record<'bass' | 'comp', number[]>>
}

export function placeholderPack(options: PlaceholderPackOptions = {}): SamplePack {
  const sampleRate = options.sampleRate ?? DEFAULT_SAMPLE_RATE
  const voices = options.voices ?? [...PERCUSSIVE, ...PITCHED]
  const layerCount = options.layers ?? 1
  const roundRobins = options.roundRobins ?? 1

  const declaration: PackDeclaration = {
    id: options.id ?? 'placeholder',
    sampleRate,
    voices: {},
  }

  for (const voice of voices) {
    if (PITCHED.includes(voice)) {
      const midis = options.notes?.[voice as 'bass' | 'comp'] ?? NOTES[voice]
      declaration.voices[voice] = {
        notes: midis.map((midi) => ({
          midi,
          layers: layersFor(voice, layerCount, roundRobins, midi),
        })),
      }
    } else {
      declaration.voices[voice] = { layers: layersFor(voice, layerCount, roundRobins) }
    }
  }

  return {
    id: declaration.id,
    describe: () => declaration,
    get(voice, opts): PackSample | null {
      const declared = declaration.voices[voice]
      if (!declared) return null

      if (declared.notes && declared.notes.length > 0) {
        const note = nearestNote(declared.notes, opts.midi)
        const file = fileFor(note.layers, opts.velocity, opts.index)
        if (!file) return null
        return {
          pcm: synthesize(file, sampleRate),
          rootMidi: note.midi,
          nominalVelocity: nominalOf(note.layers, opts.velocity),
        }
      }

      const layers = declared.layers ?? []
      const file = fileFor(layers, opts.velocity, opts.index)
      if (!file) return null
      return {
        pcm: synthesize(file, sampleRate),
        nominalVelocity: nominalOf(layers, opts.velocity),
      }
    },
  }
}

/**
 * Layers are named by their `maxVelocity`, not by their position, so the top
 * layer's first alternate carries the same file key however many layers the
 * pack declares. That is what lets a one-layer pack and a three-layer pack
 * render byte-identical audio in this epic.
 */
function layersFor(
  voice: VoiceName,
  layerCount: number,
  roundRobins: number,
  midi?: number,
): VelocityLayer[] {
  const layers: VelocityLayer[] = []

  for (let i = 0; i < layerCount; i += 1) {
    const maxVelocity = (i + 1) / layerCount
    const band = Math.round(maxVelocity * 100)
    const files: string[] = []

    for (let rr = 1; rr <= roundRobins; rr += 1) {
      const pitch = midi === undefined ? '' : `_m${midi}`
      files.push(`${voice}/${voice}${pitch}_v${band}_rr${rr}.wav`)
    }

    layers.push({ maxVelocity, files })
  }

  return layers
}

function nearestNote<T extends { midi: number }>(notes: T[], midi: number | undefined): T {
  if (midi === undefined) return notes[0]

  let best = notes[0]
  for (const note of notes) {
    if (Math.abs(note.midi - midi) < Math.abs(best.midi - midi)) best = note
  }
  return best
}

function fileFor(layers: VelocityLayer[], velocity: number, index: number): string | null {
  if (layers.length === 0) return null

  const layer = layers.find((candidate) => velocity <= candidate.maxVelocity) ?? layers.at(-1)!
  if (layer.files.length === 0) return null

  const wrapped = ((index % layer.files.length) + layer.files.length) % layer.files.length
  return layer.files[wrapped]
}

const cache = new Map<string, Pcm>()

/** Synthesis is keyed by file name, so the same name always sounds the same. */
function synthesize(file: string, sampleRate: number): Pcm {
  const key = `${file}@${sampleRate}`
  const cached = cache.get(key)
  if (cached) return cached

  const voice = file.slice(0, file.indexOf('/')) as VoiceName
  const midi = matchNumber(file, /_m(-?\d+)_/)
  const amplitude = 0.25 + 0.75 * (matchNumber(file, /_v(\d+)_/) ?? 100) / 100

  const pcm =
    midi === null
      ? noiseBurst(seedOf(file), DECAY[voice] ?? 0.2, amplitude, sampleRate)
      : decayingSine(midi, amplitude, sampleRate)

  cache.set(key, pcm)
  return pcm
}

function matchNumber(file: string, pattern: RegExp): number | null {
  const found = file.match(pattern)
  return found ? Number(found[1]) : null
}

function noiseBurst(seed: number, decaySec: number, amplitude: number, sampleRate: number): Pcm {
  const frames = Math.max(1, Math.round(decaySec * sampleRate))
  const left = new Float32Array(frames)
  const right = new Float32Array(frames)
  const random = mulberry32(seed)

  for (let i = 0; i < frames; i += 1) {
    const envelope = Math.exp(-5 * (i / frames))
    const value = amplitude * envelope * (random() * 2 - 1)
    left[i] = value
    right[i] = value
  }

  return { sampleRate, left, right }
}

function decayingSine(midi: number, amplitude: number, sampleRate: number): Pcm {
  const frames = Math.max(1, Math.round(0.9 * sampleRate))
  const frequency = 440 * 2 ** ((midi - 69) / 12)
  const left = new Float32Array(frames)
  const right = new Float32Array(frames)

  for (let i = 0; i < frames; i += 1) {
    const envelope = Math.exp(-3 * (i / frames))
    const value = amplitude * envelope * Math.sin((2 * Math.PI * frequency * i) / sampleRate)
    left[i] = value
    right[i] = value
  }

  return { sampleRate, left, right }
}

/**
 * A local FNV-1a and mulberry32. The generator's own `rng.ts` belongs to the
 * music stage; the placeholder pack keeps its noise deterministic without
 * reaching across to it.
 */
function seedOf(text: string): number {
  let hash = 0x811c9dc5
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return hash >>> 0
}

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * The midpoint of the band the requested velocity falls in — the same rule the
 * real pack applies, so a test that renders against this pack measures the same
 * scaling the catalogue does.
 */
function nominalOf(layers: VelocityLayer[], velocity: number): number {
  if (layers.length === 0) return 1
  const found = layers.findIndex((layer) => velocity <= layer.maxVelocity)
  const at = found >= 0 ? found : layers.length - 1
  const layer = layers[at]
  if (layer.nominalVelocity !== undefined) return layer.nominalVelocity
  const floor = at > 0 ? layers[at - 1].maxVelocity : 0
  return (floor + layer.maxVelocity) / 2
}
