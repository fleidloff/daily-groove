import { readFileSync, readdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import type { PackDeclaration, VelocityLayer, VoiceName } from '../types.ts'

const HERE = dirname(fileURLToPath(import.meta.url))
const decl = JSON.parse(readFileSync(join(HERE, 'pack.json'), 'utf8')) as PackDeclaration
const provenance = JSON.parse(readFileSync(join(HERE, 'provenance.json'), 'utf8')) as {
  pack: string
  licence: string
  samples: { file: string; source: string; sourceFile: string; url: string; licence: string }[]
}

/** Every audio file physically present in the pack, relative to samples/. */
function audioFiles(dir = HERE, prefix = ''): string[] {
  const out: string[] = []
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name
    if (entry.isDirectory()) out.push(...audioFiles(join(dir, entry.name), rel))
    else if (/\.(flac|wav|ogg|mp3)$/i.test(entry.name)) out.push(rel)
  }
  return out
}

/** Every file the declaration references. */
function declaredFiles(): string[] {
  const out: string[] = []
  for (const voice of Object.values(decl.voices)) {
    for (const layer of voice?.layers ?? []) out.push(...layer.files)
    for (const note of voice?.notes ?? []) {
      for (const layer of note.layers) out.push(...layer.files)
    }
  }
  return out
}

const DRUM_VOICES: VoiceName[] = [
  'kick',
  'snare',
  'hatClosed',
  'hatOpen',
  'rim',
  // Epic 5's toms play only in a fill, but they are stocked, layered and
  // round-robined under exactly the same rules as the voices that play in
  // every bar — a fill that repeats one sample three times is the machine-gun
  // artefact these rules exist to prevent.
  'tomHigh',
  'tomLow',
]
const PITCHED_VOICES: VoiceName[] = ['bass', 'comp']

// Step D1
describe('the pack declares itself', () => {
  it('parses as a PackDeclaration with an id and a sample rate', () => {
    expect(typeof decl.id).toBe('string')
    expect(decl.id.length).toBeGreaterThan(0)
    expect(decl.sampleRate).toBe(44100)
  })

  it('declares every voice the renderer can ask for', () => {
    for (const voice of [...DRUM_VOICES, ...PITCHED_VOICES]) {
      expect(decl.voices[voice], `${voice} is not declared`).toBeDefined()
    }
  })

  it('names only files that exist', () => {
    for (const file of declaredFiles()) {
      expect(existsSync(join(HERE, file)), `${file} is declared but missing`).toBe(true)
    }
  })

  it('gives every layer at least one file and a maxVelocity in (0, 1]', () => {
    const layers: VelocityLayer[] = []
    for (const voice of Object.values(decl.voices)) {
      layers.push(...(voice?.layers ?? []))
      for (const note of voice?.notes ?? []) layers.push(...note.layers)
    }
    expect(layers.length).toBeGreaterThan(0)
    for (const layer of layers) {
      expect(layer.files.length).toBeGreaterThan(0)
      expect(layer.maxVelocity).toBeGreaterThan(0)
      expect(layer.maxVelocity).toBeLessThanOrEqual(1)
    }
  })

  it('orders each voice’s layers by ascending maxVelocity, so lookup picks the first match', () => {
    for (const [name, voice] of Object.entries(decl.voices)) {
      const sets = [voice?.layers ?? [], ...(voice?.notes ?? []).map((n) => n.layers)]
      for (const layers of sets) {
        const v = layers.map((l) => l.maxVelocity)
        expect([...v].sort((a, b) => a - b), `${name} layers are out of order`).toEqual(v)
      }
    }
  })

  it('reaches full velocity, so a velocity of 1 always finds a layer', () => {
    for (const [name, voice] of Object.entries(decl.voices)) {
      const sets = [voice?.layers ?? [], ...(voice?.notes ?? []).map((n) => n.layers)]
      for (const layers of sets) {
        if (layers.length === 0) continue
        expect(layers[layers.length - 1].maxVelocity, `${name} tops out below 1`).toBe(1)
      }
    }
  })
})

// Step D2 — AC11
describe('every sample is CC0 and accounted for', () => {
  const ALLOWED = ['CC0', 'public-domain']

  it('lists every audio file present in the pack', () => {
    const listed = new Set(provenance.samples.map((s) => s.file))
    for (const file of audioFiles()) {
      expect(listed.has(file), `${file} is in the pack but not in provenance.json`).toBe(true)
    }
  })

  it('names no file that is absent', () => {
    for (const s of provenance.samples) {
      expect(existsSync(join(HERE, s.file)), `${s.file} is recorded but missing`).toBe(true)
    }
  })

  it('records a non-empty source and origin for every sample', () => {
    expect(provenance.samples.length).toBeGreaterThan(0)
    for (const s of provenance.samples) {
      expect(s.source?.length, `${s.file} has no source`).toBeGreaterThan(0)
      expect(s.sourceFile?.length, `${s.file} has no upstream path`).toBeGreaterThan(0)
      expect(s.url?.length, `${s.file} has no url`).toBeGreaterThan(0)
    }
  })

  it('carries only a licence that permits redistribution', () => {
    for (const s of provenance.samples) {
      expect(ALLOWED, `${s.file} is licensed "${s.licence}"`).toContain(s.licence)
    }
    expect(provenance.licence).toContain('CC0')
  })

  it('ships the licence text alongside the audio', () => {
    expect(existsSync(join(HERE, 'LICENSE.txt'))).toBe(true)
    expect(readFileSync(join(HERE, 'LICENSE.txt'), 'utf8')).toContain('CC0 1.0 Universal')
  })
})

// Step D3 — AC15
describe('the pack is stocked for Epic 2', () => {
  it('gives every drum voice either multiple velocity layers or multiple alternates', () => {
    for (const voice of DRUM_VOICES) {
      const layers = decl.voices[voice]?.layers ?? []
      const alternates = Math.max(...layers.map((l) => l.files.length))
      expect(
        layers.length > 1 || alternates > 1,
        `${voice} offers neither velocity layers nor round-robins`,
      ).toBe(true)
    }
  })

  it('gives the voices that repeat most a real velocity range', () => {
    for (const voice of ['kick', 'snare', 'hatClosed'] as VoiceName[]) {
      const layers = decl.voices[voice]?.layers ?? []
      expect(layers.length, `${voice} has too few velocity layers`).toBeGreaterThanOrEqual(3)
    }
  })

  it('gives every drum voice round-robin alternates, so repeated hits differ', () => {
    for (const voice of DRUM_VOICES) {
      const layers = decl.voices[voice]?.layers ?? []
      for (const layer of layers) {
        expect(
          layer.files.length,
          `${voice} layer at ${layer.maxVelocity} has a single alternate`,
        ).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('samples pitched voices densely enough that nothing shifts more than two semitones', () => {
    for (const voice of PITCHED_VOICES) {
      const notes = decl.voices[voice]?.notes ?? []
      expect(notes.length, `${voice} has too few sampled notes`).toBeGreaterThanOrEqual(5)
      const midi = notes.map((n) => n.midi).sort((a, b) => a - b)
      for (let i = 1; i < midi.length; i++) {
        const gap = midi[i] - midi[i - 1]
        // Nearest-note selection means a gap of g leaves a worst-case shift of floor(g/2).
        expect(
          Math.floor(gap / 2),
          `${voice} has a ${gap}-semitone gap at MIDI ${midi[i - 1]}`,
        ).toBeLessThanOrEqual(2)
      }
    }
  })

  /**
   * The sampled notes a source records at one velocity only, and which
   * therefore cannot carry a second layer without one being fabricated.
   *
   * VSCO 2 CE recorded the solo contrabass at two velocity groups (`v1`, `v3`)
   * only below MIDI 41; above it there is a single group. The honest options
   * were to invent a second layer — by re-levelling a take, or by promoting a
   * round-robin alternate whose level differs by a take-to-take 0.3–1.8 dB —
   * or to declare what the library holds. Inventing one would erase exactly
   * the dynamic information the un-normalised pack exists to carry, so these
   * three notes are declared with one layer and two round-robin alternates.
   *
   * The list is exhaustive on purpose: adding a note here is a decision, and a
   * new single-velocity note that nobody decided on still fails.
   */
  const SINGLE_VELOCITY_IN_SOURCE: Partial<Record<VoiceName, number[]>> = {
    bass: [42, 45, 49],
  }

  it('velocity-layers the pitched voices too', () => {
    for (const voice of PITCHED_VOICES) {
      const exempt = SINGLE_VELOCITY_IN_SOURCE[voice] ?? []
      for (const note of decl.voices[voice]?.notes ?? []) {
        if (exempt.includes(note.midi)) continue
        expect(
          note.layers.length,
          `${voice} MIDI ${note.midi} has a single velocity layer`,
        ).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('round-robins the notes it cannot velocity-layer, so a repeat never replays one file', () => {
    for (const voice of PITCHED_VOICES) {
      for (const midi of SINGLE_VELOCITY_IN_SOURCE[voice] ?? []) {
        const note = decl.voices[voice]?.notes?.find((n) => n.midi === midi)
        expect(note, `${voice} MIDI ${midi} is exempted but not declared`).toBeDefined()
        expect(
          note!.layers.flatMap((l) => l.files).length,
          `${voice} MIDI ${midi} has one velocity layer and no alternates`,
        ).toBeGreaterThanOrEqual(2)
      }
    }
  })

  it('velocity-layers most of every pitched voice, so the exemption stays an exception', () => {
    for (const voice of PITCHED_VOICES) {
      const notes = decl.voices[voice]?.notes ?? []
      const layered = notes.filter((n) => n.layers.length >= 2).length
      expect(
        layered * 2,
        `${voice} carries velocity layers on only ${layered} of its ${notes.length} notes`,
      ).toBeGreaterThan(notes.length)
    }
  })
})
