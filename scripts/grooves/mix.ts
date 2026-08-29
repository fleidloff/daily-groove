/**
 * The mix stage: per-voice tracks become one stereo buffer.
 *
 * Pure and deterministic. Each voice is levelled by its template gain and
 * placed in the image by its template pan, the tracks are summed, the region
 * rendered past the loop is folded back onto the start so the loop closes, the
 * bus rounds the crest, and the master is scaled so its TRUE peak sits on the
 * ceiling - so a groove is never clipped and never arrives silent.
 *
 * The seam is closed by overhang, not by a crossfade: `renderVoices` renders a
 * bar past the loop end, and that bar is summed onto bar 1 here. A cymbal
 * ringing at bar 4 therefore rings over bar 1 exactly as it would if the loop
 * were really repeating, and the downbeat - the one transient that must stay
 * sharp - is left alone.
 */

import type { FeelTemplate, Pcm, Track } from './types.ts'

/** Peak the mix is normalised to, ~-1 dBFS, leaving headroom for the encoder. */
export const PEAK_CEILING = 0.891

/** Largest tolerable discontinuity between the last and first sample of a loop. */
export const SEAM_THRESHOLD = 0.02

const DEFAULT_SAMPLE_RATE = 44100
const DEFAULT_BEATS_PER_BAR = 4

/** Below this the bus is exactly linear; above it the crest is rounded. */
const BUS_KNEE = 0.8

/** Inter-sample peaks are estimated on a 4x oversampled grid. */
const OVERSAMPLE = 4

/**
 * Optional, so every Epic 1 caller keeps working. Give it a loop length and the
 * mix wraps its overhang and truncates to exactly that length; leave it out and
 * the mix is as long as the longest track, as before.
 */
export type MixOptions = {
  /** Loop length in bars. Needs `bpm` unless `loopFrames` is given. */
  loopBars?: number
  bpm?: number
  /** Defaults to 4. */
  beatsPerBar?: number
  /** Loop length in frames, when the caller has already worked it out. */
  loopFrames?: number
}

export function mixTracks(tracks: Track[], template: FeelTemplate, options: MixOptions = {}): Pcm {
  const sampleRate = tracks[0]?.pcm.sampleRate ?? DEFAULT_SAMPLE_RATE
  const rendered = tracks.reduce(
    (longest, track) => Math.max(longest, track.pcm.left.length),
    0,
  )

  const loopFrames = resolveLoopFrames(options, sampleRate)

  const left = new Float32Array(rendered)
  const right = new Float32Array(rendered)

  for (const track of tracks) {
    const gain = amplitudeOf(template.gain[track.voice])
    const [leftGain, rightGain] = panGains(template.pan[track.voice])
    for (let i = 0; i < track.pcm.left.length; i += 1) {
      left[i] += track.pcm.left[i] * gain * leftGain
      right[i] += track.pcm.right[i] * gain * rightGain
    }
  }

  const master =
    loopFrames === undefined
      ? { left, right }
      : { left: wrap(left, loopFrames), right: wrap(right, loopFrames) }

  bus(master.left, master.right)
  normalise(master.left, master.right)

  return { sampleRate, left: master.left, right: master.right }
}

/**
 * True peak, estimated on a 4x oversampled grid. The highest stored sample is
 * not the highest point of the waveform it represents; normalising to the
 * stored peak alone leaves inter-sample overshoot for the encoder to clip.
 */
export function truePeak(pcm: Pcm): number {
  return Math.max(channelTruePeak(pcm.left), channelTruePeak(pcm.right))
}

function resolveLoopFrames(options: MixOptions, sampleRate: number): number | undefined {
  if (options.loopFrames !== undefined) return Math.max(0, Math.round(options.loopFrames))
  if (options.loopBars === undefined || options.bpm === undefined) return undefined

  const beatsPerBar = options.beatsPerBar ?? DEFAULT_BEATS_PER_BAR
  const beats = options.loopBars * beatsPerBar
  return Math.max(0, Math.round((beats * 60 * sampleRate) / options.bpm))
}

/**
 * Fold everything rendered past the loop back onto the start, then truncate to
 * exactly the loop length. Modulo, so an overhang longer than the loop still
 * lands where a real repeat would put it.
 */
function wrap(channel: Float32Array, loopFrames: number): Float32Array {
  const looped = new Float32Array(loopFrames)
  const kept = Math.min(loopFrames, channel.length)
  looped.set(channel.subarray(0, kept))

  if (loopFrames === 0) return looped

  for (let i = loopFrames; i < channel.length; i += 1) {
    looped[(i - loopFrames) % loopFrames] += channel[i]
  }

  return looped
}

/** dBFS to linear. An undeclared voice sits at unity. */
function amplitudeOf(dbfs: number | undefined): number {
  if (dbfs === undefined) return 1
  return 10 ** (dbfs / 20)
}

/**
 * Equal-power panning: -1 hard left, 0 centred, +1 hard right. Equal power
 * rather than linear, so a voice keeps its apparent loudness as it moves off
 * centre. An undeclared voice sits in the middle.
 */
function panGains(pan: number | undefined): [number, number] {
  const position = Math.min(1, Math.max(-1, pan ?? 0))
  const angle = ((position + 1) * Math.PI) / 4
  return [Math.cos(angle), Math.sin(angle)]
}

/**
 * Light bus processing, run at a fixed working level so it treats every mix the
 * same regardless of how loud the sum happened to arrive: normalise to unity,
 * then round anything above the knee with a soft curve. Below the knee the bus
 * is exactly linear, and the curve is continuous and smooth through it, so no
 * discontinuity is introduced at the loop seam.
 */
function bus(left: Float32Array, right: Float32Array): void {
  const peak = storedPeak(left, right)
  if (peak === 0) return

  const stage = 1 / peak
  for (let i = 0; i < left.length; i += 1) {
    left[i] = softKnee(left[i] * stage)
    right[i] = softKnee(right[i] * stage)
  }
}

function softKnee(sample: number): number {
  const magnitude = Math.abs(sample)
  if (magnitude <= BUS_KNEE) return sample

  const over = (magnitude - BUS_KNEE) / (1 - BUS_KNEE)
  const shaped = BUS_KNEE + (1 - BUS_KNEE) * Math.tanh(over)
  return Math.sign(sample) * shaped
}

/** Scale the master onto the ceiling - up as readily as down. */
function normalise(left: Float32Array, right: Float32Array): void {
  const peak = Math.max(channelTruePeak(left), channelTruePeak(right))
  if (peak === 0) return

  const gain = PEAK_CEILING / peak
  for (let i = 0; i < left.length; i += 1) {
    left[i] *= gain
    right[i] *= gain
  }
}

function storedPeak(left: Float32Array, right: Float32Array): number {
  let peak = 0
  for (let i = 0; i < left.length; i += 1) {
    peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]))
  }
  return peak
}

function channelTruePeak(channel: Float32Array): number {
  const n = channel.length
  let peak = 0

  for (let i = 0; i < n; i += 1) {
    peak = Math.max(peak, Math.abs(channel[i]))

    if (i + 1 >= n) break
    const a = channel[Math.max(0, i - 1)]
    const b = channel[i]
    const c = channel[i + 1]
    const d = channel[Math.min(n - 1, i + 2)]
    for (let step = 1; step < OVERSAMPLE; step += 1) {
      peak = Math.max(peak, Math.abs(interpolate(a, b, c, d, step / OVERSAMPLE)))
    }
  }

  return peak
}

/** Catmull-Rom, which passes through every sample and estimates between them. */
function interpolate(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
  )
}
