import { spawnSync } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { decodeAudioFile } from './decode.ts'

let dir: string
let wav: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'groove-decode-'))
  wav = join(dir, 'tone.wav')
  const made = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', 'sine=frequency=440:duration=0.5:sample_rate=44100',
    '-ac', '1', wav,
  ])
  if (made.status !== 0) {
    throw new Error(`ffmpeg is required for the generator tests: ${made.stderr}`)
  }
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('decodeAudioFile', () => {
  it('decodes a file to stereo float PCM at the requested rate', async () => {
    const pcm = await decodeAudioFile(wav)

    expect(pcm.sampleRate).toBe(44100)
    expect(pcm.left.length).toBe(pcm.right.length)

    const durationSec = pcm.left.length / pcm.sampleRate
    expect(Math.abs(durationSec - 0.5)).toBeLessThan(0.001)

    const peak = pcm.left.reduce((m, v) => Math.max(m, Math.abs(v)), 0)
    expect(peak).toBeGreaterThan(0.05)
  })

  it('duplicates a mono source across both channels', async () => {
    const pcm = await decodeAudioFile(wav)
    expect(Array.from(pcm.left.slice(0, 64))).toEqual(Array.from(pcm.right.slice(0, 64)))
  })

  it('resamples when a different rate is asked for', async () => {
    const pcm = await decodeAudioFile(wav, 22050)

    expect(pcm.sampleRate).toBe(22050)
    const durationSec = pcm.left.length / pcm.sampleRate
    expect(Math.abs(durationSec - 0.5)).toBeLessThan(0.001)
  })

  it('rejects with ffmpeg stderr when the file is missing', async () => {
    await expect(decodeAudioFile('/nope-does-not-exist.wav')).rejects.toThrow(
      /No such file or directory|nope-does-not-exist/,
    )
  })
})
