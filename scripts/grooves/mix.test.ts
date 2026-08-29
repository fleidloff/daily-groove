import { describe, expect, it } from 'vitest'
import { PEAK_CEILING, SEAM_THRESHOLD, mixTracks, truePeak } from './mix.ts'
import type { FeelTemplate, Pcm, Track, VoiceName } from './types.ts'

const SAMPLE_RATE = 44100

/** Fast enough that a whole 5-bar buffer is 220_500 frames: one bar = one second. */
const BPM = 240
const BAR_FRAMES = SAMPLE_RATE
const LOOP_BARS = 4
const LOOP_FRAMES = LOOP_BARS * BAR_FRAMES

function template(
  gain: FeelTemplate['gain'] = {},
  pan: FeelTemplate['pan'] = {},
): FeelTemplate {
  return {
    id: 'test-feel',
    tempoRange: [96, 100],
    subdivision: 16,
    swing: 0,
    flavours: ['minor'],
    voices: ['kick', 'snare', 'bass'],
    humanize: { timingMs: 0, velocity: 0 },
    gain,
    pan,
    density: { minPerBar: 1, maxPerBar: 999 },
  }
}

function tone(frames: number, frequency: number, amplitude: number): Pcm {
  const left = new Float32Array(frames)
  const right = new Float32Array(frames)
  for (let i = 0; i < frames; i += 1) {
    const v = amplitude * Math.sin((2 * Math.PI * frequency * i) / SAMPLE_RATE)
    left[i] = v
    right[i] = v
  }
  return { sampleRate: SAMPLE_RATE, left, right }
}

function track(voice: VoiceName, frames: number, frequency: number, amplitude = 0.9): Track {
  return { voice, pcm: tone(frames, frequency, amplitude) }
}

function silence(frames: number): Pcm {
  return {
    sampleRate: SAMPLE_RATE,
    left: new Float32Array(frames),
    right: new Float32Array(frames),
  }
}

function fromSamples(voice: VoiceName, samples: Float32Array): Track {
  return {
    voice,
    pcm: { sampleRate: SAMPLE_RATE, left: samples, right: Float32Array.from(samples) },
  }
}

function peak(pcm: Pcm): number {
  let max = 0
  for (let i = 0; i < pcm.left.length; i += 1) {
    max = Math.max(max, Math.abs(pcm.left[i]), Math.abs(pcm.right[i]))
  }
  return max
}

function energy(channel: Float32Array, from = 0, to = channel.length): number {
  let sum = 0
  for (let i = from; i < to; i += 1) sum += channel[i] * channel[i]
  return sum
}

/**
 * A voice that is struck three quarters of the way through the loop and is still
 * ringing when bar 5 ends - the cymbal case the overhang exists for.
 */
function ringingTail(totalFrames: number, startFrame: number): Float32Array {
  const samples = new Float32Array(totalFrames)
  const partials = [
    { frequency: 40.75, weight: 1 },
    { frequency: 40.75 * 2.7, weight: 0.5 },
    { frequency: 40.75 * 5.3, weight: 0.25 },
  ]
  const tau = 30000
  for (let i = startFrame; i < totalFrames; i += 1) {
    const n = i - startFrame
    let v = 0
    for (const partial of partials) {
      v += partial.weight * Math.sin((2 * Math.PI * partial.frequency * n) / SAMPLE_RATE)
    }
    samples[i] = (v / 1.75) * Math.exp(-n / tau)
  }
  return samples
}

describe('mixTracks', () => {
  it('sums to one buffer as long as the longest track, without clipping', () => {
    const tracks = [
      track('kick', 4000, 60),
      track('snare', 8000, 220),
      track('bass', 6000, 110),
    ]

    const mix = mixTracks(tracks, template())

    expect(mix.sampleRate).toBe(SAMPLE_RATE)
    expect(mix.left.length).toBe(8000)
    expect(mix.right.length).toBe(8000)
    expect(peak(mix)).toBeLessThan(1)
    expect(peak(mix)).toBeGreaterThan(0)
  })

  it('normalises a loud sum to the ceiling, measured as true peak', () => {
    const tracks = [track('kick', 4000, 60), track('snare', 4000, 61), track('bass', 4000, 62)]

    const mix = mixTracks(tracks, template())

    // Epic 2 normalises the INTER-SAMPLE peak, so the highest stored sample sits
    // just under the ceiling rather than exactly on it.
    expect(truePeak(mix)).toBeCloseTo(PEAK_CEILING, 5)
    expect(peak(mix)).toBeLessThanOrEqual(PEAK_CEILING + 1e-6)
  })

  it('applies each voice its template gain in dBFS', () => {
    const tracks = [track('kick', 4000, 60), track('snare', 4000, 220)]

    const even = mixTracks(tracks, template())
    const ducked = mixTracks(tracks, template({ kick: -12 }))

    expect(Array.from(ducked.left)).not.toEqual(Array.from(even.left))
  })

  it('treats a missing gain as unity', () => {
    const tracks = [track('kick', 4000, 60)]

    const implicit = mixTracks(tracks, template())
    const explicit = mixTracks(tracks, template({ kick: 0 }))

    expect(Array.from(explicit.left)).toEqual(Array.from(implicit.left))
  })

  it('leaves a silent mix silent rather than dividing by zero', () => {
    const silent: Track = { voice: 'kick', pcm: silence(16) }

    const mix = mixTracks([silent], template())

    expect(mix.left.length).toBe(16)
    expect(peak(mix)).toBe(0)
  })

  it('mixes the same tracks to the same PCM twice', () => {
    const tracks = [track('kick', 4000, 60), track('bass', 4000, 110)]

    const a = mixTracks(tracks, template({ kick: -3 }))
    const b = mixTracks(tracks, template({ kick: -3 }))

    expect(Array.from(b.left)).toEqual(Array.from(a.left))
    expect(Array.from(b.right)).toEqual(Array.from(a.right))
  })

  // Step C1 - R11
  describe('panning', () => {
    it('pushes a hard-panned voice into one channel', () => {
      const tracks = [track('hatClosed', 4000, 3000)]

      const right = mixTracks(tracks, template({}, { hatClosed: 1 }))
      const left = mixTracks(tracks, template({}, { hatClosed: -1 }))

      expect(energy(right.right)).toBeGreaterThan(energy(right.left))
      expect(energy(right.left)).toBeLessThan(1e-6)
      expect(energy(left.left)).toBeGreaterThan(energy(left.right))
      expect(energy(left.right)).toBeLessThan(1e-6)
    })

    it('keeps a centred voice equal in both channels', () => {
      const tracks = [track('kick', 4000, 60)]

      const mix = mixTracks(tracks, template({}, { kick: 0 }))

      expect(energy(mix.left)).toBeCloseTo(energy(mix.right), 4)
      expect(energy(mix.left)).toBeGreaterThan(0)
    })

    it('treats a missing pan as centred', () => {
      const tracks = [track('kick', 4000, 60)]

      const implicit = mixTracks(tracks, template())
      const explicit = mixTracks(tracks, template({}, { kick: 0 }))

      expect(Array.from(explicit.left)).toEqual(Array.from(implicit.left))
      expect(Array.from(explicit.right)).toEqual(Array.from(implicit.right))
    })

    it('spreads two voices to opposite sides of the image', () => {
      const tracks = [track('hatClosed', 4000, 3000), track('rim', 4000, 900)]

      const mix = mixTracks(tracks, template({}, { hatClosed: 0.8, rim: -0.8 }))

      // Both sides carry signal, but the two are no longer identical channels.
      expect(energy(mix.left)).toBeGreaterThan(0)
      expect(energy(mix.right)).toBeGreaterThan(0)
      expect(Array.from(mix.left)).not.toEqual(Array.from(mix.right))
    })
  })

  // Step C2 - R14, R15, AC9
  describe('the overhang wraps onto the start', () => {
    it('folds the fifth bar onto the first and truncates to the loop', () => {
      const samples = new Float32Array(5 * BAR_FRAMES)
      // Bar 4 is loud, so the ramp stays inside the bus stage's linear region.
      for (let i = 3 * BAR_FRAMES; i < 4 * BAR_FRAMES; i += 1) {
        samples[i] = Math.sin((2 * Math.PI * 100 * i) / SAMPLE_RATE)
      }
      const ramp = (i: number): number => (0.4 * i) / BAR_FRAMES
      for (let i = 0; i < BAR_FRAMES; i += 1) {
        samples[4 * BAR_FRAMES + i] = ramp(i)
      }

      const mix = mixTracks([fromSamples('comp', samples)], template(), {
        loopBars: LOOP_BARS,
        bpm: BPM,
      })

      expect(mix.left.length).toBe(LOOP_FRAMES)
      expect(mix.right.length).toBe(LOOP_FRAMES)

      const master = mix.left[BAR_FRAMES - 1] / ramp(BAR_FRAMES - 1)
      expect(master).toBeGreaterThan(0)
      for (const i of [1000, 10_000, 20_000, 30_000, BAR_FRAMES - 2]) {
        expect(mix.left[i]).toBeCloseTo(master * ramp(i), 5)
      }
      expect(mix.left[0]).toBeCloseTo(0, 6)
    })

    it('returns exactly the loop length when the tracks are shorter than it', () => {
      const mix = mixTracks([fromSamples('kick', new Float32Array(BAR_FRAMES))], template(), {
        loopBars: LOOP_BARS,
        bpm: BPM,
      })

      expect(mix.left.length).toBe(LOOP_FRAMES)
    })

    it('leaves the buffer untruncated when no loop length is given', () => {
      const mix = mixTracks([fromSamples('kick', new Float32Array(5 * BAR_FRAMES))], template())

      expect(mix.left.length).toBe(5 * BAR_FRAMES)
    })
  })

  // Step C3 - R12, R13, AC7, AC8
  describe('normalisation', () => {
    it('holds an over-loud mix at the ceiling and below full scale', () => {
      const tracks = [
        track('kick', 4000, 60, 4),
        track('snare', 4000, 220, 3),
        track('bass', 4000, 110, 5),
      ]

      const mix = mixTracks(tracks, template())

      expect(truePeak(mix)).toBeCloseTo(PEAK_CEILING, 5)
      expect(peak(mix)).toBeLessThan(1)
    })

    it('brings a quiet mix up to the ceiling', () => {
      const tracks = [track('kick', 4000, 60, 0.001), track('bass', 4000, 110, 0.0004)]

      const mix = mixTracks(tracks, template())

      expect(truePeak(mix)).toBeCloseTo(PEAK_CEILING, 5)
      expect(peak(mix)).toBeGreaterThan(0.5)
    })

    it('lands a quiet and a loud version of the same mix on the same master', () => {
      const quiet = mixTracks([track('kick', 4000, 60, 0.002)], template())
      const loud = mixTracks([track('kick', 4000, 60, 6)], template())

      for (const i of [0, 137, 1500, 3999]) {
        expect(quiet.left[i]).toBeCloseTo(loud.left[i], 4)
      }
    })

    it('measures true peak above the highest stored sample', () => {
      // Six samples per cycle: no sample ever lands on the crest of this sine.
      const pcm = tone(4000, SAMPLE_RATE / 6, 0.5)
      let stored = 0
      for (let i = 0; i < pcm.left.length; i += 1) stored = Math.max(stored, Math.abs(pcm.left[i]))

      expect(truePeak(pcm)).toBeGreaterThan(stored)
    })

    it('rounds the crest of the bus rather than letting it through untouched', () => {
      const mix = mixTracks([track('bass', 4000, 110, 0.9)], template())

      const input = tone(4000, 110, 0.9)
      const inputCrest = peak(input) / Math.sqrt(energy(input.left) / 4000)
      const outputCrest = peak(mix) / Math.sqrt(energy(mix.left) / mix.left.length)

      // A pure gain change leaves the crest factor untouched; the bus stage does not.
      expect(outputCrest).toBeLessThan(inputCrest * 0.99)
    })
  })

  // Step C4 - R15, AC9
  describe('the seam', () => {
    it('joins the last sample to the first below the seam threshold', () => {
      const samples = ringingTail(5 * BAR_FRAMES, LOOP_FRAMES - BAR_FRAMES / 2)

      const mix = mixTracks([fromSamples('hatOpen', samples)], template(), {
        loopBars: LOOP_BARS,
        bpm: BPM,
      })

      const last = mix.left.length - 1
      expect(Math.abs(mix.left[last] - mix.left[0])).toBeLessThan(SEAM_THRESHOLD)
      expect(Math.abs(mix.right[last] - mix.right[0])).toBeLessThan(SEAM_THRESHOLD)

      const head = energy(mix.left, 0, 512) / 512
      const tail = energy(mix.left, mix.left.length - 512) / 512
      expect(head).toBeGreaterThan(tail / 2)
      expect(head).toBeLessThan(tail * 2)
    })

    it('is what the wrap fixes - a tail cut at the loop point leaves the seam open', () => {
      const cut = ringingTail(5 * BAR_FRAMES, LOOP_FRAMES - BAR_FRAMES / 2).slice(0, LOOP_FRAMES)

      const mix = mixTracks([fromSamples('hatOpen', cut)], template())

      const last = mix.left.length - 1
      expect(Math.abs(mix.left[last] - mix.left[0])).toBeGreaterThan(SEAM_THRESHOLD)
    })
  })
})
