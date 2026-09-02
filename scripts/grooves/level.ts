import type { Pcm, Track, VoiceName } from './types.ts'

export function rmsDbfs(pcm: Pcm): number {
  const frames = pcm.left.length
  if (frames === 0) return Number.NEGATIVE_INFINITY

  let sum = 0
  for (let i = 0; i < frames; i += 1) {
    sum += pcm.left[i] * pcm.left[i] + pcm.right[i] * pcm.right[i]
  }

  const rms = Math.sqrt(sum / (frames * 2))
  if (rms === 0) return Number.NEGATIVE_INFINITY
  return 20 * Math.log10(rms)
}

export function voiceLevels(tracks: Track[]): Map<VoiceName, number> {
  const levels = new Map<VoiceName, number>()
  for (const track of tracks) {
    levels.set(track.voice, rmsDbfs(track.pcm))
  }
  return levels
}
