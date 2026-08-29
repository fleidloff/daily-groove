import { describe, expect, it } from 'vitest'
import type { Pcm } from './types.ts'
import { deinterleave, interleave } from './pcmio.ts'

function makePcm(n: number, sampleRate = 44100): Pcm {
  const left = new Float32Array(n)
  const right = new Float32Array(n)
  for (let i = 0; i < n; i += 1) {
    left[i] = Math.sin(i / 7)
    right[i] = -Math.cos(i / 11)
  }
  return { sampleRate, left, right }
}

describe('interleave / deinterleave', () => {
  it('round-trips a stereo buffer exactly', () => {
    const pcm = makePcm(1024)
    const back = deinterleave(interleave(pcm), pcm.sampleRate)

    expect(back.sampleRate).toBe(44100)
    expect(back.left).toEqual(pcm.left)
    expect(back.right).toEqual(pcm.right)
  })

  it('writes L,R,L,R in order', () => {
    const pcm: Pcm = {
      sampleRate: 8000,
      left: Float32Array.from([0.25, -0.5]),
      right: Float32Array.from([0.75, -1]),
    }

    expect(Array.from(interleave(pcm))).toEqual([0.25, 0.75, -0.5, -1])
  })

  it('deinterleaves raw frames back into two channels', () => {
    const raw = Float32Array.from([0.25, 0.75, -0.5, -1])
    const pcm = deinterleave(raw, 8000)

    expect(Array.from(pcm.left)).toEqual([0.25, -0.5])
    expect(Array.from(pcm.right)).toEqual([0.75, -1])
  })

  it('handles an empty buffer', () => {
    const pcm = deinterleave(new Float32Array(0), 44100)
    expect(pcm.left.length).toBe(0)
    expect(pcm.right.length).toBe(0)
  })
})
