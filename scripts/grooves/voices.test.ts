import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildEvents } from './events.ts'
import { loadPack } from './pack.ts'
import { readCatalogue } from './catalogue.ts'
import { templateById } from './templates/index.ts'
import { placeholderPack } from './testing/placeholderPack.ts'
import type { NoteEvent, PackDeclaration, Pcm, SamplePack, VoiceName } from './types.ts'
import { renderVoices } from './voices.ts'

const SAMPLE_RATE = 44100

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

function region(pcm: Pcm, startSec: number, lengthSec = 0.15): Float32Array {
  const start = Math.round(startSec * pcm.sampleRate)
  return pcm.left.slice(start, start + Math.round(lengthSec * pcm.sampleRate))
}

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

    const [same] = renderVoices(hits, placeholderPack({ layers: 1, roundRobins: 1 }), SAMPLE_RATE)
    expect(Array.from(same.pcm.left)).toEqual(Array.from(plain.pcm.left))
  })

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

    it('does not replay a pass on the same alternates as the one before it', () => {
      const HITS_PER_PASS = 4
      const PASSES = 4
      const BPM = 60
      const PASS_SEC = 16
      const pack = placeholderPack({ roundRobins: 2 })
      const events: NoteEvent[] = []
      for (let pass = 0; pass < PASSES; pass += 1) {
        for (let hit = 0; hit < HITS_PER_PASS; hit += 1) {
          events.push({
            voice: 'kick',
            timeSec: pass * PASS_SEC + hit * (PASS_SEC / HITS_PER_PASS),
            durationSec: 0.5,
            velocity: 0.8,
          })
        }
      }

      const [track] = renderVoices(events, pack, SAMPLE_RATE, {
        id: 'groove-01',
        bars: 4 * PASSES,
        bpm: BPM,
        passes: PASSES,
      })

      const signatures = Array.from({ length: PASSES }, (_, pass) =>
        events
          .slice(pass * HITS_PER_PASS, (pass + 1) * HITS_PER_PASS)
          .map((event) => normalized(region(track.pcm, event.timeSec)).join(','))
          .join('|'),
      )

      for (let pass = 1; pass < PASSES; pass += 1) {
        expect(signatures[pass], `pass ${pass} replays pass ${pass - 1}`).not.toBe(
          signatures[pass - 1],
        )
      }
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

  describe('the committed pack is sampled densely enough', () => {
    const stubDecoder = async (): Promise<Pcm> => ({
      sampleRate: SAMPLE_RATE,
      left: new Float32Array(64).fill(0.5),
      right: new Float32Array(64).fill(0.5),
    })

    const samplesDir = fileURLToPath(new URL('./samples', import.meta.url))

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

    const pitched: NoteEvent[] = [
      ...Array.from({ length: 26 }, (_, i) => ({
        voice: 'bass' as const,
        timeSec: i * 0.05,
        durationSec: 0.05,
        velocity: 0.8,
        midi: 26 + i,
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

  describe('overhang', () => {
    const BPM = 120
    const SEC_PER_BAR = (4 * 60) / BPM

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

  describe('velocity scaling', () => {
    const RECORDED = [
      { maxVelocity: 0.45, nominalVelocity: 0.225 },
      { maxVelocity: 1, nominalVelocity: 0.725 },
    ]

    const declaration: PackDeclaration = {
      id: 'recorded',
      sampleRate: SAMPLE_RATE,
      voices: {
        kick: {
          layers: RECORDED.map((layer) => ({
            maxVelocity: layer.maxVelocity,
            nominalVelocity: layer.nominalVelocity,
            files: [`kick/kick_v${Math.round(layer.maxVelocity * 100)}.wav`],
          })),
        },
      },
    }

    function burst(level: number): Pcm {
      return {
        sampleRate: SAMPLE_RATE,
        left: new Float32Array(64).fill(level),
        right: new Float32Array(64).fill(level),
      }
    }

    function recordedPack(): { pack: SamplePack; served: number[] } {
      const served: number[] = []
      return {
        served,
        pack: {
          id: declaration.id,
          describe: () => declaration,
          get(_voice, opts) {
            const layer = RECORDED.find((l) => opts.velocity <= l.maxVelocity) ?? RECORDED.at(-1)!
            served.push(layer.nominalVelocity)
            return { pcm: burst(layer.nominalVelocity), nominalVelocity: layer.nominalVelocity }
          },
        },
      }
    }

    function peakAt(pack: SamplePack, velocity: number): number {
      const [track] = renderVoices(
        [{ voice: 'kick', timeSec: 0, durationSec: 0.1, velocity }],
        pack,
        SAMPLE_RATE,
      )
      return peak(track.pcm.left)
    }

    const SWEEP = Array.from({ length: 40 }, (_, i) => 0.02 * 50 ** (i / 39))

    it('has no step at a layer boundary', () => {
      const { pack, served } = recordedPack()
      const peaks = SWEEP.map((velocity) => peakAt(pack, velocity))

      expect(new Set(served).size).toBe(2)

      for (let i = 1; i < peaks.length; i += 1) {
        const where = `velocity ${SWEEP[i].toFixed(3)}`
        expect(peaks[i], `${where} is quieter than the step below it`).toBeGreaterThanOrEqual(
          peaks[i - 1],
        )
        expect(peaks[i] / peaks[i - 1], `step at ${where}`).toBeLessThanOrEqual(1.3)
      }
    })

    it("applies a layer's recorded loudness once, not once per velocity", () => {
      const { pack } = recordedPack()

      const ratio = peakAt(pack, 1) / peakAt(pack, 0.1)
      expect(ratio).toBeGreaterThan(8)
      expect(ratio).toBeLessThan(12.5)
    })
  })
})

function rms(pcm: Pcm, fromSec: number, toSec: number): number {
  const from = Math.max(0, Math.round(fromSec * pcm.sampleRate))
  const to = Math.min(pcm.left.length, Math.round(toSec * pcm.sampleRate))
  if (to <= from) return 0

  let sum = 0
  for (let i = from; i < to; i += 1) sum += pcm.left[i] * pcm.left[i]
  return Math.sqrt(sum / (to - from))
}

function steadyPack(lengthSec: number, sampleRate = SAMPLE_RATE): SamplePack {
  const frames = Math.round(lengthSec * sampleRate)
  const left = new Float32Array(frames)
  const right = new Float32Array(frames)
  for (let i = 0; i < frames; i += 1) {
    const value = 0.5 * Math.sin((2 * Math.PI * 220 * i) / sampleRate)
    left[i] = value
    right[i] = value
  }
  const pcm: Pcm = { sampleRate, left, right }

  return {
    id: 'steady',
    describe: () => ({ id: 'steady', sampleRate, voices: {} }),
    get: () => ({ pcm, nominalVelocity: 1 }),
  }
}

describe('a note stops at its duration', () => {
  it('has decayed by the end of a short duration, not the sample length', () => {
    const [track] = renderVoices(
      [{ voice: 'comp', timeSec: 0, durationSec: 0.1, velocity: 1, midi: 60 }],
      steadyPack(2),
      SAMPLE_RATE,
      { bars: 1, bpm: 120 },
    )

    const held = rms(track.pcm, 0, 0.05)
    const after = rms(track.pcm, 0.15, 0.5)

    expect(held).toBeGreaterThan(0)
    expect(after).toBeLessThan(held / 1000)
  })

  it('releases rather than cutting, so the stop is not a click', () => {
    const [track] = renderVoices(
      [{ voice: 'comp', timeSec: 0, durationSec: 0.1, velocity: 1, midi: 60 }],
      steadyPack(2),
      SAMPLE_RATE,
      { bars: 1, bpm: 120 },
    )

    const releasing = rms(track.pcm, 0.1, 0.104)
    expect(releasing).toBeGreaterThan(0)
    expect(releasing).toBeLessThan(rms(track.pcm, 0, 0.05))
  })

  it('leaves a sample shorter than its duration alone', () => {
    const [track] = renderVoices(
      [{ voice: 'comp', timeSec: 0, durationSec: 1, velocity: 1, midi: 60 }],
      steadyPack(0.2),
      SAMPLE_RATE,
      { bars: 1, bpm: 120 },
    )

    expect(rms(track.pcm, 0, 0.2)).toBeGreaterThan(0)
    expect(rms(track.pcm, 0.2, 0.5)).toBe(0)
  })
})

describe('a closed hat chokes an open one', () => {
  function hats(closedAt: number[]): NoteEvent[] {
    return [
      { voice: 'hatOpen', timeSec: 0, durationSec: 1, velocity: 1 },
      ...closedAt.map((timeSec) => ({
        voice: 'hatClosed' as const,
        timeSec,
        durationSec: 0.05,
        velocity: 0.8,
      })),
    ]
  }

  function openTrack(events: NoteEvent[]) {
    const tracks = renderVoices(events, steadyPack(1), SAMPLE_RATE, { bars: 1, bpm: 120 })
    const open = tracks.find((track) => track.voice === 'hatOpen')
    if (!open) throw new Error('no hatOpen track rendered')
    return open
  }

  it('stops the open hat at the closed hat onset', () => {
    const track = openTrack(hats([0.2]))

    const ringing = rms(track.pcm, 0, 0.1)
    const choked = rms(track.pcm, 0.25, 0.5)

    expect(ringing).toBeGreaterThan(0)
    expect(choked).toBeLessThan(ringing / 100)
  })

  it('leaves an open hat alone when no closed hat follows it', () => {
    const track = openTrack(hats([]))

    expect(rms(track.pcm, 0.25, 0.5)).toBeGreaterThan(rms(track.pcm, 0, 0.1) / 2)
  })

  it('does not silence an open hat that starts after the closed one', () => {
    const track = openTrack([
      { voice: 'hatClosed', timeSec: 0.2, durationSec: 0.05, velocity: 0.8 },
      { voice: 'hatOpen', timeSec: 0.4, durationSec: 0.5, velocity: 1 },
    ])

    expect(rms(track.pcm, 0.45, 0.6)).toBeGreaterThan(0)
  })
})

describe('the comp’s three layers against its curve', () => {
  const samplesDir = fileURLToPath(new URL('./samples', import.meta.url))

  const stubDecoder = async (): Promise<Pcm> => ({
    sampleRate: SAMPLE_RATE,
    left: new Float32Array(64).fill(0.5),
    right: new Float32Array(64).fill(0.5),
  })

  function compBands(declaration: PackDeclaration): number[] {
    const notes = declaration.voices.comp?.notes ?? []
    expect(notes.length, 'the comp declares no sampled notes').toBeGreaterThan(0)
    const bands = notes.map((note) => note.layers.map((layer) => layer.maxVelocity).join(','))
    expect(new Set(bands).size, 'the comp’s notes declare different bands').toBe(1)
    return notes[0].layers.map((layer) => layer.maxVelocity)
  }

  const nominalsOf = (bands: number[]) =>
    bands.map((ceiling, i) => ((i > 0 ? bands[i - 1] : 0) + ceiling) / 2)

  function catalogueComp() {
    return readCatalogue().map((spec) => {
      const feel = templateById(spec.template)
      const { events, music } = buildEvents(spec, feel)
      return {
        id: spec.id,
        template: spec.template,
        music,
        feel,
        events,
        comp: events.filter((event) => event.voice === 'comp'),
      }
    })
  }

  it('spreads the curve across more than one velocity layer', async () => {
    const real = await loadPack(samplesDir, stubDecoder)
    const bands = compBands(real.describe())
    const nominals = nominalsOf(bands)
    const layerOf = new Map(nominals.map((nominal, i) => [nominal, i]))

    const served: number[] = []
    const watched: SamplePack = {
      ...real,
      get(voice: VoiceName, opts) {
        const sample = real.get(voice, opts)
        if (voice === 'comp' && sample) served.push(layerOf.get(sample.nominalVelocity) ?? -1)
        return sample
      },
    }

    for (const groove of catalogueComp()) {
      renderVoices(groove.events, watched, SAMPLE_RATE, {
        id: groove.id,
        bars: groove.music.loopBars,
        bpm: groove.music.bpm,
        passes: groove.music.loopBars / groove.music.bars,
      })
    }

    expect(served.length, 'the catalogue rendered no comp events').toBeGreaterThan(0)
    const counts = bands.map((_, layer) => served.filter((chosen) => chosen === layer).length)
    const shares = counts.map((count) => count / served.length)

    console.log(
      `comp layer distribution over ${served.length} hits: ` +
        counts
          .map((count, i) => `≤${bands[i]} ${count} (${(100 * shares[i]).toFixed(1)}%)`)
          .join('  '),
    )

    expect(counts.filter((count) => count > 0).length, 'the curve sits inside one layer').toBeGreaterThan(1)
    expect(Math.max(...shares), 'one layer takes almost every comp hit').toBeLessThanOrEqual(0.9)
  })

  function measuredClamp(): number {
    const flat: Pcm = {
      sampleRate: SAMPLE_RATE,
      left: new Float32Array(64).fill(1),
      right: new Float32Array(64).fill(1),
    }
    const [track] = renderVoices(
      [{ voice: 'comp', timeSec: 0, durationSec: 0.001, velocity: 1, midi: 60 }],
      {
        id: 'clamp',
        describe: () => ({ id: 'clamp', sampleRate: SAMPLE_RATE, voices: {} }),
        get: () => ({ pcm: flat, nominalVelocity: 0.05 }),
      },
      SAMPLE_RATE,
    )
    return peak(track.pcm.left)
  }

  it('carries the shades between layers on the gain, and stays under the clamp', async () => {
    const bands = compBands((await loadPack(samplesDir, stubDecoder)).describe())
    const nominals = nominalsOf(bands)
    const clamp = measuredClamp()
    expect(clamp, 'the renderer applies no ceiling at all').toBeGreaterThan(1)

    const gains = new Set<number>()
    let highest = { gain: 0, velocity: 0, where: '' }

    for (const groove of catalogueComp()) {
      for (const event of groove.comp) {
        const layer = bands.findIndex((ceiling) => event.velocity <= ceiling)
        const nominal = nominals[layer < 0 ? nominals.length - 1 : layer]
        const gain = event.velocity / nominal
        gains.add(Number(gain.toFixed(9)))
        if (gain > highest.gain) {
          highest = { gain, velocity: event.velocity, where: groove.id }
        }
      }
    }

    expect(
      highest.gain,
      `${highest.where} asks its layer for ${highest.gain.toFixed(4)}× at velocity ` +
        `${highest.velocity.toFixed(4)}`,
    ).toBeLessThan(clamp)

    expect(gains.size, 'the comp plays at three levels, one per layer').toBeGreaterThan(3)
  })

  it('puts no step at a layer boundary, however wide the curve reaches', async () => {
    const real = await loadPack(samplesDir, stubDecoder)
    const bands = compBands(real.describe())
    const nominals = nominalsOf(bands)

    const served: number[] = []
    const recorded: SamplePack = {
      id: 'recorded-comp',
      describe: () => ({ id: 'recorded-comp', sampleRate: SAMPLE_RATE, voices: {} }),
      get(_voice, opts) {
        const found = bands.findIndex((ceiling) => opts.velocity <= ceiling)
        const at = found < 0 ? bands.length - 1 : found
        served.push(at)
        return {
          pcm: {
            sampleRate: SAMPLE_RATE,
            left: new Float32Array(64).fill(nominals[at]),
            right: new Float32Array(64).fill(nominals[at]),
          },
          nominalVelocity: nominals[at],
        }
      },
    }

    const levelAt = (velocity: number) =>
      peak(
        renderVoices(
          [{ voice: 'comp', timeSec: 0, durationSec: 0.001, velocity, midi: 60 }],
          recorded,
          SAMPLE_RATE,
        )[0].pcm.left,
      )

    const HAIR = 1e-6

    for (const boundary of bands.slice(0, -1)) {
      served.length = 0
      const under = levelAt(boundary)
      const over = levelAt(boundary + HAIR)

      expect(new Set(served).size, `velocity ${boundary} never changes layer`).toBe(2)
      expect(
        Math.abs(over / under - 1),
        `a step at the ${boundary} boundary: ${under.toFixed(6)} then ${over.toFixed(6)}`,
      ).toBeLessThan(0.01)
    }
  })

  it('asks the committed pack for nothing it does not already declare', async () => {
    const declaration = (await loadPack(samplesDir, stubDecoder)).describe()
    const notes = declaration.voices.comp?.notes ?? []

    expect(notes.length, 'the comp’s sampled notes changed under this epic').toBe(11)
    for (const note of notes) {
      expect(note.layers.map((layer) => layer.maxVelocity), `comp MIDI ${note.midi}`).toEqual([
        0.45, 0.8, 1,
      ])
      for (const layer of note.layers) {
        expect(layer.files.length, `comp MIDI ${note.midi}`).toBe(1)
      }
    }
  })
})
