/**
 * Measuring how loud something is, so levelling is a measurement rather than an
 * opinion.
 *
 * Separate from `mix.ts` deliberately. `mix.ts` is the renderer: it imports the
 * room, the bus knee and the oversampler, and the quality gate must not drag
 * any of that in to ask one question about amplitude. This module imports
 * nothing but the types.
 *
 * Why RMS and not peak. `mixTracks` ends in a bus knee and every groove is
 * checked against `PEAK_CEILING`, so the peak is the one thing that has already
 * been equalised across the catalogue — which makes it useless for telling
 * whether a groove *sounds* as loud as its neighbour. Two grooves at the same
 * true peak differ in loudness by however much their density and crest factor
 * differ, and across a 62 bpm ballad and a 106 bpm sixteenth funk that is
 * several decibels.
 */

import type { Pcm, Track, VoiceName } from './types.ts'

/**
 * RMS of a buffer, in dBFS.
 *
 * Silence returns `-Infinity` rather than `NaN`: it is the honest limit of
 * `20·log₁₀(0)`, it compares correctly against any threshold, and a caller that
 * forgets to handle it gets an obviously wrong number instead of one that
 * poisons an average silently.
 */
export function rmsDbfs(pcm: Pcm): number {
  const frames = pcm.left.length
  if (frames === 0) return Number.NEGATIVE_INFINITY

  // One forward pass with one accumulator, so the result does not depend on the
  // order the samples are visited and two calls agree exactly.
  let sum = 0
  for (let i = 0; i < frames; i += 1) {
    sum += pcm.left[i] * pcm.left[i] + pcm.right[i] * pcm.right[i]
  }

  const rms = Math.sqrt(sum / (frames * 2))
  if (rms === 0) return Number.NEGATIVE_INFINITY
  return 20 * Math.log10(rms)
}

/**
 * Every voice's own level, before the mix applies gain or pan.
 *
 * A silent voice is reported as `-Infinity` rather than omitted: a voice that is
 * absent from the arrangement and a voice that is present but inaudible are
 * different findings, and collapsing them hides the one worth acting on.
 */
export function voiceLevels(tracks: Track[]): Map<VoiceName, number> {
  const levels = new Map<VoiceName, number>()
  for (const track of tracks) {
    levels.set(track.voice, rmsDbfs(track.pcm))
  }
  return levels
}
