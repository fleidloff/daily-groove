/**
 * Loading a sample pack from a directory.
 *
 * The pack is reached only through its `pack.json` declaration - never through
 * hard-coded paths - which is what lets the real CC0 pack and the synthesized
 * placeholder pack satisfy one interface.
 *
 * Decoding happens once, here, at load time. `get` is synchronous and serves
 * already-decoded buffers, so the voices stage stays a pure function and no
 * render ever spawns a process per note.
 */

import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { type Decoder, decodeAudioFile } from './decode.ts'
import type {
  PackDeclaration,
  PackSample,
  Pcm,
  SamplePack,
  VelocityLayer,
  VoiceName,
} from './types.ts'

/** How many files are decoded at once. One subprocess each, so keep it modest. */
const DECODE_CONCURRENCY = 8

export async function loadPack(dir: string, decode: Decoder = decodeAudioFile): Promise<SamplePack> {
  const declaration = JSON.parse(
    await readFile(join(dir, 'pack.json'), 'utf8'),
  ) as PackDeclaration

  const buffers = await decodeAll(dir, filesOf(declaration), declaration.sampleRate, decode)

  return {
    id: declaration.id,
    describe: () => declaration,
    get(voice: VoiceName, opts): PackSample | null {
      const declared = declaration.voices[voice]
      if (!declared) return null

      if (declared.notes && declared.notes.length > 0) {
        const note = nearestNote(declared.notes, opts.midi)
        const chosen = pick(buffers, note.layers, opts.velocity, opts.index)
        return chosen
          ? { pcm: chosen.pcm, rootMidi: note.midi, nominalVelocity: chosen.nominalVelocity }
          : null
      }

      const chosen = pick(buffers, declared.layers ?? [], opts.velocity, opts.index)
      return chosen ? { pcm: chosen.pcm, nominalVelocity: chosen.nominalVelocity } : null
    },
  }
}

/** Every file the declaration names, once, in declaration order. */
function filesOf(declaration: PackDeclaration): string[] {
  const files = new Set<string>()

  for (const declared of Object.values(declaration.voices)) {
    if (!declared) continue
    for (const layer of declared.layers ?? []) {
      for (const file of layer.files) files.add(file)
    }
    for (const note of declared.notes ?? []) {
      for (const layer of note.layers) {
        for (const file of layer.files) files.add(file)
      }
    }
  }

  return [...files]
}

async function decodeAll(
  dir: string,
  files: string[],
  sampleRate: number,
  decode: Decoder,
): Promise<Map<string, Pcm>> {
  const buffers = new Map<string, Pcm>()
  let next = 0

  const workers = Array.from({ length: Math.min(DECODE_CONCURRENCY, files.length) }, async () => {
    while (next < files.length) {
      const file = files[next]
      next += 1
      buffers.set(file, startFromSilence(await decode(join(dir, file), sampleRate)))
    }
  })

  await Promise.all(workers)
  return buffers
}

/**
 * How long a sample is ramped up from zero, if it does not already start there.
 *
 * Half a millisecond — 22 frames at 44.1 kHz — which is below the ear's ability
 * to hear an attack soften and far shorter than the shortest transient in the
 * pack.
 */
const LEAD_IN_SEC = 0.0005

/** Below this a first frame is silence for practical purposes. */
const SILENT_ENOUGH = 1e-4

/**
 * Ramp a sample up from zero if its first frame is not already there.
 *
 * A sample that begins mid-waveform is a step from silence, and the loop seam
 * is where that step gets found: `mixTracks` folds the overhang onto bar one, so
 * the first sample of the render survives into the wrapped buffer as a
 * discontinuity against the decaying tail at the last one — and then `normalise`
 * multiplies it by whatever gain the master needed. Three of the committed
 * samples start as high as 0.008, all of them the cajon standing in for a kick,
 * and after normalisation that is enough to put two grooves over the gate's
 * seam threshold once anything shifts the mix balance.
 *
 * Trimming the sample properly is the real fix and belongs to whoever restocks
 * the pack. Doing it here as well costs nothing and makes the guarantee hold for
 * whatever arrives next, rather than for the files that happen to be committed
 * today.
 */
function startFromSilence(pcm: Pcm): Pcm {
  if (Math.abs(pcm.left[0]) < SILENT_ENOUGH && Math.abs(pcm.right[0]) < SILENT_ENOUGH) return pcm

  const frames = Math.min(Math.round(LEAD_IN_SEC * pcm.sampleRate), pcm.left.length)
  const left = Float32Array.from(pcm.left)
  const right = Float32Array.from(pcm.right)
  for (let i = 0; i < frames; i += 1) {
    const ramp = i / frames
    left[i] *= ramp
    right[i] *= ramp
  }

  return { sampleRate: pcm.sampleRate, left, right }
}

function nearestNote<T extends { midi: number }>(notes: T[], midi: number | undefined): T {
  if (midi === undefined) return notes[0]

  let best = notes[0]
  for (const note of notes) {
    if (Math.abs(note.midi - midi) < Math.abs(best.midi - midi)) best = note
  }
  return best
}

/**
 * The first layer whose `maxVelocity` covers the request, then the alternate at
 * `index` wrapped into that layer's round-robins. Epic 1's caller passes
 * `velocity: 1, index: 0`, so it always lands on the top layer's first file and
 * leaves the rest of the pack for Epic 2.
 */
function pick(
  buffers: Map<string, Pcm>,
  layers: VelocityLayer[],
  velocity: number,
  index: number,
): { pcm: Pcm; nominalVelocity: number } | null {
  if (layers.length === 0) return null

  const found = layers.findIndex((candidate) => velocity <= candidate.maxVelocity)
  const at = found >= 0 ? found : layers.length - 1
  const layer = layers[at]
  if (layer.files.length === 0) return null

  const wrapped = ((index % layer.files.length) + layer.files.length) % layer.files.length
  const pcm = buffers.get(layer.files[wrapped])
  if (!pcm) return null

  return { pcm, nominalVelocity: nominalOf(layers, at) }
}

/**
 * The velocity a layer's samples represent: its declared value, or the midpoint
 * of the band it covers. The band runs from the previous layer's ceiling to its
 * own, so the top layer of a 0.45/1.0 pair is nominally 0.725.
 */
function nominalOf(layers: VelocityLayer[], at: number): number {
  const layer = layers[at]
  if (layer.nominalVelocity !== undefined) return layer.nominalVelocity
  const floor = at > 0 ? layers[at - 1].maxVelocity : 0
  return (floor + layer.maxVelocity) / 2
}
