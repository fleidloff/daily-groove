import type { FeelTemplate, Pcm, Track } from './types.ts'

export const PEAK_CEILING = 0.891

export const SEAM_THRESHOLD = 0.02

const DEFAULT_SAMPLE_RATE = 44100
const DEFAULT_BEATS_PER_BAR = 4

export const ROOM_SEND = 0.18

const ROOM_DECAY_SEC = 0.6

const COMB_DELAYS_SEC = [0.0297, 0.0331, 0.0371, 0.0411]
const ALLPASS_DELAYS_SEC = [0.005, 0.0017]

const ALLPASS_GAIN = 0.5

const BUS_KNEE = 0.8

const OVERSAMPLE = 4

export type MixOptions = {
  loopBars?: number
  bpm?: number
  beatsPerBar?: number
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

  applyRoom(left, right, sampleRate)

  const master =
    loopFrames === undefined
      ? { left, right }
      : { left: wrap(left, loopFrames), right: wrap(right, loopFrames) }

  bus(master.left, master.right)
  normalise(master.left, master.right)

  return { sampleRate, left: master.left, right: master.right }
}

export function truePeak(pcm: Pcm): number {
  return Math.max(channelTruePeak(pcm.left), channelTruePeak(pcm.right))
}

export function applyRoom(left: Float32Array, right: Float32Array, sampleRate: number): void {
  room(left, sampleRate)
  room(right, sampleRate)
}

function room(channel: Float32Array, sampleRate: number): void {
  if (channel.length === 0) return

  const wet = new Float32Array(channel.length)
  for (const seconds of COMB_DELAYS_SEC) {
    const delay = primeFrames(seconds, sampleRate)
    comb(channel, wet, delay, feedbackFor(delay, sampleRate))
  }
  for (let i = 0; i < wet.length; i += 1) wet[i] /= COMB_DELAYS_SEC.length

  for (const seconds of ALLPASS_DELAYS_SEC) {
    allpass(wet, primeFrames(seconds, sampleRate))
  }

  for (let i = 0; i < channel.length; i += 1) channel[i] += ROOM_SEND * wet[i]
}

function comb(input: Float32Array, wet: Float32Array, delay: number, feedback: number): void {
  const line = new Float32Array(delay)
  let cursor = 0
  for (let i = 0; i < input.length; i += 1) {
    const delayed = line[cursor]
    line[cursor] = input[i] + delayed * feedback
    wet[i] += delayed
    cursor = cursor + 1 === delay ? 0 : cursor + 1
  }
}

function allpass(signal: Float32Array, delay: number): void {
  const line = new Float32Array(delay)
  let cursor = 0
  for (let i = 0; i < signal.length; i += 1) {
    const delayed = line[cursor]
    const stored = signal[i] + ALLPASS_GAIN * delayed
    signal[i] = delayed - ALLPASS_GAIN * stored
    line[cursor] = stored
    cursor = cursor + 1 === delay ? 0 : cursor + 1
  }
}

function feedbackFor(delay: number, sampleRate: number): number {
  return 10 ** ((-3 * delay) / (ROOM_DECAY_SEC * sampleRate))
}

function primeFrames(seconds: number, sampleRate: number): number {
  let frames = Math.max(2, Math.round(seconds * sampleRate))
  while (!isPrime(frames)) frames += 1
  return frames
}

function isPrime(n: number): boolean {
  if (n < 2) return false
  if (n % 2 === 0) return n === 2
  for (let d = 3; d * d <= n; d += 2) {
    if (n % d === 0) return false
  }
  return true
}

function resolveLoopFrames(options: MixOptions, sampleRate: number): number | undefined {
  if (options.loopFrames !== undefined) return Math.max(0, Math.round(options.loopFrames))
  if (options.loopBars === undefined || options.bpm === undefined) return undefined

  const beatsPerBar = options.beatsPerBar ?? DEFAULT_BEATS_PER_BAR
  const beats = options.loopBars * beatsPerBar
  return Math.max(0, Math.round((beats * 60 * sampleRate) / options.bpm))
}

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

function amplitudeOf(dbfs: number | undefined): number {
  if (dbfs === undefined) return 1
  return 10 ** (dbfs / 20)
}

function panGains(pan: number | undefined): [number, number] {
  const position = Math.min(1, Math.max(-1, pan ?? 0))
  const angle = ((position + 1) * Math.PI) / 4
  return [Math.cos(angle), Math.sin(angle)]
}

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

function interpolate(a: number, b: number, c: number, d: number, t: number): number {
  const t2 = t * t
  const t3 = t2 * t
  return (
    0.5 * (2 * b + (c - a) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3)
  )
}
