import { describe, expect, it } from 'vitest'
import { rmsDbfs, voiceLevels } from './level.ts'
import type { Pcm, Track } from './types.ts'

function constantPcm(value: number, frames = 1000): Pcm {
  return {
    sampleRate: 44100,
    left: new Float32Array(frames).fill(value),
    right: new Float32Array(frames).fill(value),
  }
}

describe('rmsDbfs', () => {
  it('measures a constant buffer at its own level', () => {
    // A constant 0.5 is exactly half full scale, which is -6.02 dBFS.
    expect(rmsDbfs(constantPcm(0.5))).toBeCloseTo(-6.02, 2)
    expect(rmsDbfs(constantPcm(1))).toBeCloseTo(0, 6)
  })

  it('reports silence as -Infinity rather than NaN', () => {
    expect(rmsDbfs(constantPcm(0))).toBe(Number.NEGATIVE_INFINITY)
    expect(rmsDbfs({ sampleRate: 44100, left: new Float32Array(0), right: new Float32Array(0) })).toBe(
      Number.NEGATIVE_INFINITY,
    )
  })

  it('is reproducible and independent of sample order', () => {
    const pcm = constantPcm(0.3)
    for (let i = 0; i < pcm.left.length; i += 1) {
      pcm.left[i] = Math.sin(i) * 0.4
      pcm.right[i] = Math.cos(i) * 0.2
    }
    const once = rmsDbfs(pcm)
    expect(rmsDbfs(pcm)).toBe(once)

    const reversed: Pcm = {
      sampleRate: pcm.sampleRate,
      left: Float32Array.from([...pcm.left].reverse()),
      right: Float32Array.from([...pcm.right].reverse()),
    }
    expect(rmsDbfs(reversed)).toBeCloseTo(once, 10)
  })

  it('halving the amplitude costs about six decibels', () => {
    expect(rmsDbfs(constantPcm(0.5)) - rmsDbfs(constantPcm(0.25))).toBeCloseTo(6.02, 2)
  })
})

describe('voiceLevels', () => {
  it('reports each voice at its own level', () => {
    const tracks: Track[] = [
      { voice: 'kick', pcm: constantPcm(0.5) },
      { voice: 'snare', pcm: constantPcm(0.25) },
    ]
    const levels = voiceLevels(tracks)
    expect(levels.get('kick')! - levels.get('snare')!).toBeCloseTo(6.02, 2)
  })

  it('reports a silent voice rather than omitting it', () => {
    // A voice absent from the arrangement and a voice present but inaudible are
    // different findings; the second is the one worth acting on.
    const levels = voiceLevels([{ voice: 'bongoHigh', pcm: constantPcm(0) }])
    expect(levels.has('bongoHigh')).toBe(true)
    expect(levels.get('bongoHigh')).toBe(Number.NEGATIVE_INFINITY)
  })
})
