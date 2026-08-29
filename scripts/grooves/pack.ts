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
        const pcm = pick(buffers, note.layers, opts.velocity, opts.index)
        return pcm ? { pcm, rootMidi: note.midi } : null
      }

      const pcm = pick(buffers, declared.layers ?? [], opts.velocity, opts.index)
      return pcm ? { pcm } : null
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
      buffers.set(file, await decode(join(dir, file), sampleRate))
    }
  })

  await Promise.all(workers)
  return buffers
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
): Pcm | null {
  if (layers.length === 0) return null

  const layer = layers.find((candidate) => velocity <= candidate.maxVelocity) ?? layers.at(-1)!
  if (layer.files.length === 0) return null

  const wrapped = ((index % layer.files.length) + layer.files.length) % layer.files.length
  return buffers.get(layer.files[wrapped]) ?? null
}
