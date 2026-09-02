import type { Pcm } from './types.ts'

export function interleave(pcm: Pcm): Float32Array {
  const frames = Math.min(pcm.left.length, pcm.right.length)
  const raw = new Float32Array(frames * 2)

  for (let i = 0; i < frames; i += 1) {
    raw[i * 2] = pcm.left[i]
    raw[i * 2 + 1] = pcm.right[i]
  }

  return raw
}

export function deinterleave(raw: Float32Array, sampleRate: number): Pcm {
  const frames = Math.floor(raw.length / 2)
  const left = new Float32Array(frames)
  const right = new Float32Array(frames)

  for (let i = 0; i < frames; i += 1) {
    left[i] = raw[i * 2]
    right[i] = raw[i * 2 + 1]
  }

  return { sampleRate, left, right }
}
