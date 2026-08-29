import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { loadPack } from './pack.ts'
import type { PackDeclaration, Pcm } from './types.ts'

const here = dirname(fileURLToPath(import.meta.url))

const declaration: PackDeclaration = {
  id: 'temp-pack',
  sampleRate: 44100,
  voices: {
    kick: {
      layers: [
        { maxVelocity: 0.5, files: ['kick_soft.wav'] },
        { maxVelocity: 1, files: ['kick_hard_a.wav', 'kick_hard_b.wav'] },
      ],
    },
    bass: {
      notes: [
        { midi: 36, layers: [{ maxVelocity: 1, files: ['bass_36.wav'] }] },
        { midi: 48, layers: [{ maxVelocity: 1, files: ['bass_48.wav'] }] },
      ],
    },
  },
}

const files = ['kick_soft.wav', 'kick_hard_a.wav', 'kick_hard_b.wav', 'bass_36.wav', 'bass_48.wav']

let dir: string

function tone(path: string, frequency: number) {
  const made = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', `sine=frequency=${frequency}:duration=0.2:sample_rate=44100`,
    '-ac', '1', path,
  ])
  if (made.status !== 0) {
    throw new Error(`ffmpeg is required for the generator tests: ${made.stderr}`)
  }
}

function silence(sampleRate = 44100, frames = 8): Pcm {
  return { sampleRate, left: new Float32Array(frames), right: new Float32Array(frames) }
}

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'groove-pack-'))
  mkdirSync(dir, { recursive: true })
  files.forEach((name, i) => tone(join(dir, name), 220 + i * 55))
  writeFileSync(join(dir, 'pack.json'), JSON.stringify(declaration, null, 2))
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('loadPack', () => {
  it('loads a directory into a SamplePack', async () => {
    const pack = await loadPack(dir)

    expect(pack.id).toBe('temp-pack')
    expect(pack.describe()).toEqual(declaration)

    const kick = pack.get('kick', { velocity: 1, index: 0 })
    expect(kick).not.toBeNull()
    expect(kick!.pcm.left.length).toBeGreaterThan(0)
    expect(kick!.pcm.left.length).toBe(kick!.pcm.right.length)
  })

  it('decodes every declared file exactly once and never again', async () => {
    const seen: string[] = []
    const pack = await loadPack(dir, async (path) => {
      seen.push(path)
      return silence()
    })

    expect(seen.length).toBe(files.length)
    expect(new Set(seen).size).toBe(files.length)

    for (let i = 0; i < 100; i += 1) {
      expect(pack.get('kick', { velocity: 1, index: i })).not.toBeNull()
      expect(pack.get('bass', { velocity: 1, index: i, midi: 36 + i })).not.toBeNull()
    }

    expect(seen.length).toBe(files.length)
  })

  it('picks the first layer whose maxVelocity covers the request', async () => {
    const decoded = new Map<string, Pcm>()
    const pack = await loadPack(dir, async (path) => {
      const pcm = silence(44100, decoded.size + 1)
      decoded.set(path, pcm)
      return pcm
    })

    const soft = pack.get('kick', { velocity: 0.3, index: 0 })!
    const hard = pack.get('kick', { velocity: 0.9, index: 0 })!

    expect(soft.pcm).toBe(decoded.get(join(dir, 'kick_soft.wav')))
    expect(hard.pcm).toBe(decoded.get(join(dir, 'kick_hard_a.wav')))
  })

  it('round-robins through a layer alternates by index', async () => {
    const decoded = new Map<string, Pcm>()
    const pack = await loadPack(dir, async (path) => {
      const pcm = silence(44100, decoded.size + 1)
      decoded.set(path, pcm)
      return pcm
    })

    const a = pack.get('kick', { velocity: 1, index: 0 })!
    const b = pack.get('kick', { velocity: 1, index: 1 })!
    const wrapped = pack.get('kick', { velocity: 1, index: 2 })!

    expect(b.pcm).not.toBe(a.pcm)
    expect(wrapped.pcm).toBe(a.pcm)
  })

  it('picks the nearest sampled note for a pitched voice', async () => {
    const pack = await loadPack(dir)

    expect(pack.get('bass', { velocity: 1, index: 0, midi: 38 })!.rootMidi).toBe(36)
    expect(pack.get('bass', { velocity: 1, index: 0, midi: 45 })!.rootMidi).toBe(48)
  })

  it('returns null for an undeclared voice', async () => {
    const pack = await loadPack(dir)
    expect(pack.get('hatOpen', { velocity: 1, index: 0 })).toBeNull()
  })
})

describe('the committed sample pack', () => {
  it('loads through the same interface as any other pack', async () => {
    const pack = await loadPack(join(here, 'samples'))

    expect(pack.describe().sampleRate).toBe(44100)

    const kick = pack.get('kick', { velocity: 1, index: 0 })!
    expect(kick.pcm.left.length).toBeGreaterThan(0)

    const bass = pack.get('bass', { velocity: 1, index: 0, midi: 38 })!
    expect(typeof bass.rootMidi).toBe('number')
    expect(bass.pcm.left.length).toBeGreaterThan(0)
  }, 120_000)
})
