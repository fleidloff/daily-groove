import { mkdtempSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { encodeMp3 } from './encode.ts'
import type { Pcm } from './types.ts'

const SAMPLE_RATE = 44100

let dir: string

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'groove-encode-'))
})

afterAll(() => {
  rmSync(dir, { recursive: true, force: true })
})

function oneSecond(): Pcm {
  const frames = SAMPLE_RATE
  const left = new Float32Array(frames)
  const right = new Float32Array(frames)
  for (let i = 0; i < frames; i += 1) {
    left[i] = 0.5 * Math.sin((2 * Math.PI * 220 * i) / SAMPLE_RATE)
    right[i] = 0.5 * Math.sin((2 * Math.PI * 330 * i) / SAMPLE_RATE)
  }
  return { sampleRate: SAMPLE_RATE, left, right }
}

describe('encodeMp3', () => {
  it('writes a playable mp3', async () => {
    const out = join(dir, 'groove-01.mp3')

    await encodeMp3(oneSecond(), out)

    expect(statSync(out).size).toBeGreaterThan(1024)

    const head = readFileSync(out)
    const isId3 = head[0] === 0x49 && head[1] === 0x44 && head[2] === 0x33
    const isFrameSync = head[0] === 0xff && (head[1] & 0xe0) === 0xe0
    expect(isId3 || isFrameSync).toBe(true)
  }, 30_000)

  it('rejects with ffmpeg stderr when the path cannot be written', async () => {
    await expect(
      encodeMp3(oneSecond(), '/no-such-directory-here/groove.mp3'),
    ).rejects.toThrow(/ffmpeg/i)
  }, 30_000)
})
