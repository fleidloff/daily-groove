import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { loadPack } from './pack.ts'
import { placeholderPack } from './testing/placeholderPack.ts'
import type { NoteEvent, Pcm, SamplePack, VoiceName } from './types.ts'
import { renderVoices } from './voices.ts'

const SAMPLE_RATE = 44100

/** Events are written by hand: this track never depends on the music stage. */
const events: NoteEvent[] = [
  { voice: 'kick', timeSec: 0, durationSec: 0.5, velocity: 1 },
  { voice: 'bass', timeSec: 0.5, durationSec: 0.5, velocity: 1, midi: 40 },
  { voice: 'comp', timeSec: 1.5, durationSec: 0.5, velocity: 1, midi: 60 },
]

function energy(pcm: Pcm): number {
  let sum = 0
  for (let i = 0; i < pcm.left.length; i += 1) sum += pcm.left[i] * pcm.left[i]
  return sum
}

/** Crossings per second over an early window, which stands in for pitch. */
function crossingRate(pcm: Pcm, windowSec = 0.2): number {
  const frames = Math.min(pcm.left.length, Math.round(windowSec * pcm.sampleRate))
  let count = 0
  for (let i = 1; i < frames; i += 1) {
    const a = pcm.left[i - 1]
    const b = pcm.left[i]
    if (Math.abs(a) < 1e-4 || Math.abs(b) < 1e-4) continue
    if ((a < 0) !== (b < 0)) count += 1
  }
  return count / (frames / pcm.sampleRate)
}

function peak(samples: Float32Array): number {
  let max = 0
  for (const value of samples) max = Math.max(max, Math.abs(value))
  return max
}

/** The window a single hit occupies, so one event can be compared with another. */
function region(pcm: Pcm, startSec: number, lengthSec = 0.15): Float32Array {
  const start = Math.round(startSec * pcm.sampleRate)
  return pcm.left.slice(start, start + Math.round(lengthSec * pcm.sampleRate))
}

/**
 * Scaled to unit peak, so "these are different recordings" can be told apart
 * from "this is the same recording, quieter".
 */
function normalized(samples: Float32Array): Float32Array {
  const max = peak(samples)
  if (max === 0) return samples
  return samples.map((value) => value / max)
}

function maxDifference(a: Float32Array, b: Float32Array): number {
  let max = 0
  for (let i = 0; i < Math.min(a.length, b.length); i += 1) {
    max = Math.max(max, Math.abs(a[i] - b[i]))
  }
  return max
}

/** How many of the given windows are distinguishable recordings. */
function distinctCount(regions: Float32Array[]): number {
  const kept: Float32Array[] = []
  for (const candidate of regions) {
    if (!kept.some((seen) => maxDifference(seen, candidate) < 1e-3)) kept.push(candidate)
  }
  return kept.length
}

describe('renderVoices', () => {
  it('renders one track per voice, spanning the events', () => {
    const tracks = renderVoices(events, placeholderPack(), SAMPLE_RATE)

    expect(tracks.map((t) => t.voice)).toEqual(['kick', 'bass', 'comp'])

    for (const track of tracks) {
      expect(track.pcm.sampleRate).toBe(SAMPLE_RATE)
      expect(track.pcm.left.length).toBe(track.pcm.right.length)
      // 2 s: the last event starts at 1.5 s and lasts 0.5 s.
      expect(track.pcm.left.length).toBe(Math.round(2 * SAMPLE_RATE))
    }
  })

  it('gives every track non-zero energy', () => {
    const tracks = renderVoices(events, placeholderPack(), SAMPLE_RATE)

    for (const track of tracks) {
      expect(energy(track.pcm)).toBeGreaterThan(0)
    }
  })

  it('places each event at its own offset and leaves the run-up silent', () => {
    const [bass] = renderVoices([events[1]], placeholderPack(), SAMPLE_RATE)
    const onset = Math.round(0.5 * SAMPLE_RATE)

    const before = bass.pcm.left.slice(0, onset)
    expect(before.reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toBe(0)

    const after = bass.pcm.left.slice(onset, onset + 512)
    expect(after.reduce((m, v) => Math.max(m, Math.abs(v)), 0)).toBeGreaterThan(0)
  })

  it('scales by the event velocity', () => {
    const loud = renderVoices(
      [{ voice: 'kick', timeSec: 0, durationSec: 1, velocity: 1 }],
      placeholderPack(),
      SAMPLE_RATE,
    )[0]
    const soft = renderVoices(
      [{ voice: 'kick', timeSec: 0, durationSec: 1, velocity: 0.25 }],
      placeholderPack(),
      SAMPLE_RATE,
    )[0]

    expect(energy(soft.pcm)).toBeLessThan(energy(loud.pcm))
    expect(energy(soft.pcm)).toBeGreaterThan(0)
  })

  it('clips a sample that would run past the end of the buffer', () => {
    const short: NoteEvent[] = [{ voice: 'kick', timeSec: 0, durationSec: 0.01, velocity: 1 }]
    const [track] = renderVoices(short, placeholderPack(), SAMPLE_RATE)

    expect(track.pcm.left.length).toBe(Math.round(0.01 * SAMPLE_RATE))
    expect(energy(track.pcm)).toBeGreaterThan(0)
  })

  it('returns no tracks for no events', () => {
    expect(renderVoices([], placeholderPack(), SAMPLE_RATE)).toEqual([])
  })

  it('transposes a pitched sample to the requested note', () => {
    // One sampled bass note only, so 52 must be reached by resampling.
    const pack = placeholderPack({ notes: { bass: [40] } })

    const low = renderVoices(
      [{ voice: 'bass', timeSec: 0, durationSec: 1, velocity: 1, midi: 40 }],
      pack,
      SAMPLE_RATE,
    )[0]
    const high = renderVoices(
      [{ voice: 'bass', timeSec: 0, durationSec: 1, velocity: 1, midi: 52 }],
      pack,
      SAMPLE_RATE,
    )[0]

    const ratio = crossingRate(high.pcm) / crossingRate(low.pcm)
    expect(ratio).toBeGreaterThan(1.8)
    expect(ratio).toBeLessThan(2.2)
  })

  it('renders the same events to the same PCM twice', () => {
    const a = renderVoices(events, placeholderPack(), SAMPLE_RATE)
    const b = renderVoices(events, placeholderPack(), SAMPLE_RATE)

    expect(a.length).toBe(b.length)
    for (let i = 0; i < a.length; i += 1) {
      expect(Array.from(b[i].pcm.left)).toEqual(Array.from(a[i].pcm.left))
      expect(Array.from(b[i].pcm.right)).toEqual(Array.from(a[i].pcm.right))
    }
  })

  /**
   * Epic 1's version of this test asserted the opposite - that the extra
   * material a pack declares was deliberately ignored. Epic 2 supersedes it:
   * declaring layers and alternates must now change what is rendered.
   */
  it('renders differently when the pack declares layers and alternates', () => {
    const hits: NoteEvent[] = [
      { voice: 'kick', timeSec: 0, durationSec: 0.5, velocity: 0.2 },
      { voice: 'kick', timeSec: 0.5, durationSec: 0.5, velocity: 0.2 },
    ]

    const [plain] = renderVoices(hits, placeholderPack(), SAMPLE_RATE)
    const [stocked] = renderVoices(
      hits,
      placeholderPack({ layers: 3, roundRobins: 3 }),
      SAMPLE_RATE,
    )

    expect(Array.from(stocked.pcm.left)).not.toEqual(Array.from(plain.pcm.left))

    // A pack with nothing extra to offer still renders exactly as before.
    const [same] = renderVoices(hits, placeholderPack({ layers: 1, roundRobins: 1 }), SAMPLE_RATE)
    expect(Array.from(same.pcm.left)).toEqual(Array.from(plain.pcm.left))
  })

  // Step B1 - R1, AC1
  describe('velocity layers', () => {
    it('picks a different recording for a soft hit than for a loud one', () => {
      const pack = placeholderPack({ layers: 2 })

      const [soft] = renderVoices(
        [{ voice: 'kick', timeSec: 0, durationSec: 0.5, velocity: 0.2 }],
        pack,
        SAMPLE_RATE,
      )
      const [loud] = renderVoices(
        [{ voice: 'kick', timeSec: 0, durationSec: 0.5, velocity: 0.95 }],
        pack,
        SAMPLE_RATE,
      )

      const difference = maxDifference(
        normalized(region(soft.pcm, 0)),
        normalized(region(loud.pcm, 0)),
      )
      expect(difference).toBeGreaterThan(0.1)
    })

    it('is the layer that differs, not the gain', () => {
      // One layer: the same recording, so normalizing makes the two identical.
      const pack = placeholderPack({ layers: 1 })

      const [soft] = renderVoices(
        [{ voice: 'kick', timeSec: 0, durationSec: 0.5, velocity: 0.2 }],
        pack,
        SAMPLE_RATE,
      )
      const [loud] = renderVoices(
        [{ voice: 'kick', timeSec: 0, durationSec: 0.5, velocity: 0.95 }],
        pack,
        SAMPLE_RATE,
      )

      const difference = maxDifference(
        normalized(region(soft.pcm, 0)),
        normalized(region(loud.pcm, 0)),
      )
      expect(difference).toBeLessThan(1e-3)
    })

    it('reaches every declared layer as the velocity climbs', () => {
      const pack = placeholderPack({ layers: 3 })
      const regions = [0.2, 0.5, 0.9].map((velocity) => {
        const [track] = renderVoices(
          [{ voice: 'kick', timeSec: 0, durationSec: 0.5, velocity }],
          pack,
          SAMPLE_RATE,
        )
        return normalized(region(track.pcm, 0))
      })

      expect(distinctCount(regions)).toBe(3)
    })
  })

  // Step B2 - R2, AC2
  describe('round-robins', () => {
    const repeated: NoteEvent[] = [0, 0.5, 1, 1.5].map((timeSec) => ({
      voice: 'kick',
      timeSec,
      durationSec: 0.5,
      velocity: 0.8,
    }))

    it('rotates through the alternates on repeated hits', () => {
      const [track] = renderVoices(repeated, placeholderPack({ roundRobins: 3 }), SAMPLE_RATE)
      const regions = repeated.map((event) => normalized(region(track.pcm, event.timeSec)))

      expect(distinctCount(regions)).toBeGreaterThanOrEqual(2)
    })

    it('plays a different recording on each consecutive hit', () => {
      const [track] = renderVoices(repeated, placeholderPack({ roundRobins: 3 }), SAMPLE_RATE)
      const regions = repeated.map((event) => normalized(region(track.pcm, event.timeSec)))

      for (let i = 1; i < regions.length; i += 1) {
        expect(maxDifference(regions[i - 1], regions[i])).toBeGreaterThan(0.1)
      }
    })

    it('starts on a seeded alternate, so not every groove opens the same way', () => {
      const pack = placeholderPack({ roundRobins: 3 })
      const first = ['g1', 'g2', 'g3', 'g4', 'g5', 'g6', 'g7', 'g8'].map((id) => {
        const [track] = renderVoices(
          [{ voice: 'kick', timeSec: 0, durationSec: 0.5, velocity: 0.8 }],
          pack,
          SAMPLE_RATE,
          { id },
        )
        return normalized(region(track.pcm, 0))
      })

      expect(distinctCount(first)).toBeGreaterThan(1)
    })

    it('makes the same choices every time for the same id', () => {
      const pack = placeholderPack({ roundRobins: 3, layers: 3 })
      const render = () =>
        renderVoices(repeated, pack, SAMPLE_RATE, { id: 'groove-42' })[0].pcm.left

      expect(Array.from(render())).toEqual(Array.from(render()))
    })

    it('rotates each voice on its own counter', () => {
      const pack = placeholderPack({ roundRobins: 2 })
      const interleaved: NoteEvent[] = [
        { voice: 'kick', timeSec: 0, durationSec: 0.5, velocity: 0.8 },
        { voice: 'snare', timeSec: 0.25, durationSec: 0.5, velocity: 0.8 },
        { voice: 'kick', timeSec: 0.5, durationSec: 0.5, velocity: 0.8 },
        { voice: 'snare', timeSec: 0.75, durationSec: 0.5, velocity: 0.8 },
      ]

      const [kick] = renderVoices(interleaved, pack, SAMPLE_RATE, { id: 'groove-42' })
      const onlyKicks = renderVoices(
        interleaved.filter((event) => event.voice === 'kick'),
        pack,
        SAMPLE_RATE,
        { id: 'groove-42' },
      )[0]

      // A snare between two kicks must not steal the kick's next alternate.
      expect(maxDifference(normalized(region(kick.pcm, 0.5)), normalized(region(onlyKicks.pcm, 0.5))))
        .toBeLessThan(1e-3)
    })

    it('draws nothing from Math.random', () => {
      const pack = placeholderPack({ roundRobins: 3, layers: 3 })
      const original = Math.random
      Math.random = () => {
        throw new Error('renderVoices must not call Math.random')
      }
      try {
        expect(() => renderVoices(repeated, pack, SAMPLE_RATE, { id: 'groove-42' })).not.toThrow()
      } finally {
        Math.random = original
      }
    })
  })

  // Step B2b - R3
  describe('the committed pack is sampled densely enough', () => {
    /**
     * Only the declaration matters here, so files are never decoded: a stub
     * decoder stands in for ffmpeg and the assertion is about which sampled
     * note `pack.get` hands back for each event.
     */
    const stubDecoder = async (): Promise<Pcm> => ({
      sampleRate: SAMPLE_RATE,
      left: new Float32Array(64).fill(0.5),
      right: new Float32Array(64).fill(0.5),
    })

    const samplesDir = fileURLToPath(new URL('./samples', import.meta.url))

    /** Wraps a pack so the test can see the `rootMidi` chosen for every event. */
    function watch(pack: SamplePack): { pack: SamplePack; picks: { midi: number; root: number }[] } {
      const picks: { midi: number; root: number }[] = []
      return {
        picks,
        pack: {
          ...pack,
          get(voice: VoiceName, opts) {
            const sample = pack.get(voice, opts)
            if (sample?.rootMidi !== undefined && opts.midi !== undefined) {
              picks.push({ midi: opts.midi, root: sample.rootMidi })
            }
            return sample
          },
        },
      }
    }

    /** The whole register the README claims is covered, one event per semitone. */
    const pitched: NoteEvent[] = [
      ...Array.from({ length: 29 }, (_, i) => ({
        voice: 'bass' as const,
        timeSec: i * 0.05,
        durationSec: 0.05,
        velocity: 0.8,
        midi: 22 + i,
      })),
      ...Array.from({ length: 41 }, (_, i) => ({
        voice: 'comp' as const,
        timeSec: i * 0.05,
        durationSec: 0.05,
        velocity: 0.8,
        midi: 46 + i,
      })),
    ]

    it('never shifts a sample more than two semitones', async () => {
      const real = await loadPack(samplesDir, stubDecoder)
      const { pack, picks } = watch(real)

      renderVoices(pitched, pack, SAMPLE_RATE)

      expect(picks.length).toBe(pitched.length)
      for (const { midi, root } of picks) {
        expect(Math.abs(midi - root)).toBeLessThanOrEqual(2)
      }
    })
  })

  // Step B3 - R14
  describe('overhang', () => {
    const BPM = 120
    const SEC_PER_BAR = (4 * 60) / BPM // 2 s at 120 bpm

    it('renders one bar past the loop when asked', () => {
      const [track] = renderVoices(
        [{ voice: 'kick', timeSec: 0, durationSec: 0.5, velocity: 0.8 }],
        placeholderPack(),
        SAMPLE_RATE,
        { bars: 4, bpm: BPM, overhangBars: 1 },
      )

      expect(track.pcm.left.length).toBe(Math.round(5 * SEC_PER_BAR * SAMPLE_RATE))
      expect(track.pcm.right.length).toBe(track.pcm.left.length)
    })

    it('lets a tail at the end of bar 4 ring into the fifth bar', () => {
      const tail: NoteEvent[] = [
        { voice: 'hatOpen', timeSec: 4 * SEC_PER_BAR - 0.1, durationSec: 0.1, velocity: 1 },
      ]

      const [track] = renderVoices(tail, placeholderPack(), SAMPLE_RATE, {
        bars: 4,
        bpm: BPM,
        overhangBars: 1,
      })

      const overhang = track.pcm.left.slice(Math.round(4 * SEC_PER_BAR * SAMPLE_RATE))
      expect(peak(overhang)).toBeGreaterThan(0)
    })

    it('is exactly the loop when no overhang is asked for', () => {
      const tail: NoteEvent[] = [
        { voice: 'hatOpen', timeSec: 4 * SEC_PER_BAR - 0.1, durationSec: 0.1, velocity: 1 },
      ]

      const [track] = renderVoices(tail, placeholderPack(), SAMPLE_RATE, { bars: 4, bpm: BPM })

      expect(track.pcm.left.length).toBe(Math.round(4 * SEC_PER_BAR * SAMPLE_RATE))
    })

    it('still spans the events when no grid is given', () => {
      const [track] = renderVoices(events, placeholderPack(), SAMPLE_RATE, {})

      expect(track.pcm.left.length).toBe(Math.round(2 * SAMPLE_RATE))
    })
  })
})
