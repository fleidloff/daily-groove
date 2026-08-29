/**
 * Raw f32 <-> Pcm. Pure: no filesystem, no subprocess.
 *
 * ffmpeg speaks interleaved `f32le` frames at both ends of the pipeline, and
 * the rest of the generator works on planar stereo. These two functions are the
 * only place that knows which is which.
 */

import type { Pcm } from './types.ts'

/** Planar stereo to interleaved `L,R,L,R...` frames. */
export function interleave(pcm: Pcm): Float32Array {
  const frames = Math.min(pcm.left.length, pcm.right.length)
  const raw = new Float32Array(frames * 2)

  for (let i = 0; i < frames; i += 1) {
    raw[i * 2] = pcm.left[i]
    raw[i * 2 + 1] = pcm.right[i]
  }

  return raw
}

/** Interleaved `L,R,L,R...` frames back to planar stereo. */
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
