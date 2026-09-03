import { beforeAll, describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { loadPack } from './pack.ts'
import {
  NOTE_SECONDS,
  RELEASE_SECONDS,
  noteFileName,
  noteSpecs,
  renderNote,
} from './notes.ts'
import { ROOTS } from '../../src/lib/theory/roots.ts'
import type { SamplePack, VoiceName } from './types.ts'

const SAMPLE_RATE = 44100
const PACK_DIR = join(import.meta.dirname, 'samples')

let pack: SamplePack

beforeAll(async () => {
  pack = await loadPack(PACK_DIR)
}, 120_000)

function peakOver(
  pcm: { left: Float32Array; right: Float32Array },
  from: number,
  until: number,
): number {
  let peak = 0
  for (let i = from; i < until; i += 1) {
    peak = Math.max(peak, Math.abs(pcm.left[i]), Math.abs(pcm.right[i]))
  }
  return peak
}

describe('renderNote', () => {
  it('renders exactly NOTE_SECONDS of audio', () => {
    const note = renderNote(pack, 60, SAMPLE_RATE)

    expect(note.sampleRate).toBe(SAMPLE_RATE)
    expect(note.left.length).toBe(Math.round(NOTE_SECONDS * SAMPLE_RATE))
    expect(note.right.length).toBe(Math.round(NOTE_SECONDS * SAMPLE_RATE))
  })

  it('renders the same samples every time', () => {
    const first = renderNote(pack, 60, SAMPLE_RATE)
    const second = renderNote(pack, 60, SAMPLE_RATE)

    expect(Array.from(second.left)).toEqual(Array.from(first.left))
    expect(Array.from(second.right)).toEqual(Array.from(first.right))
  })

  it('ends on silence', () => {
    const note = renderNote(pack, 60, SAMPLE_RATE)
    const last = note.left.length - 1

    expect(Math.abs(note.left[last])).toBe(0)
    expect(Math.abs(note.right[last])).toBe(0)
  })

  it('is quieter over the last 10 ms than before the release begins', () => {
    const note = renderNote(pack, 60, SAMPLE_RATE)
    const total = note.left.length
    const rampStart = total - Math.round(RELEASE_SECONDS * SAMPLE_RATE)

    const tail = peakOver(note, total - Math.round(0.01 * SAMPLE_RATE), total)
    const before = peakOver(note, rampStart - Math.round(0.1 * SAMPLE_RATE), rampStart)

    expect(tail).toBeLessThan(before)
  })

  it('gives every root the same length and the same peak', () => {
    const peaks = ROOTS.map((root, i) => {
      const note = renderNote(pack, 60 + i, SAMPLE_RATE)
      expect(note.left.length).toBe(Math.round(NOTE_SECONDS * SAMPLE_RATE))
      return peakOver(note, 0, note.left.length)
    })

    const loudest = Math.max(...peaks)
    const quietest = Math.min(...peaks)
    expect(20 * Math.log10(loudest / quietest)).toBeLessThan(1)
  })
})

describe('noteFileName', () => {
  it('spells an accidental in ASCII', () => {
    expect(noteFileName('C', 4)).toBe('note-c.mp3')
    expect(noteFileName('C♯', 4)).toBe('note-c-sharp.mp3')
    expect(noteFileName('E♭', 4)).toBe('note-e-flat.mp3')
  })

  it('suffixes the octave above the base one, and only that one', () => {
    expect(noteFileName('C', 5)).toBe('note-c-5.mp3')
    expect(noteFileName('C♯', 5)).toBe('note-c-sharp-5.mp3')
    expect(noteFileName('E♭', 5)).toBe('note-e-flat-5.mp3')
  })
})

describe('noteSpecs', () => {
  it('covers every root in ROOTS order, once per octave', () => {
    const roots = noteSpecs().map((spec) => spec.root)

    expect(roots.slice(0, 12)).toEqual(ROOTS)
    expect(roots.slice(12)).toEqual(ROOTS)
  })

  it('renders twenty-four pitches, numbered 60 to 83', () => {
    const specs = noteSpecs()

    expect(specs).toHaveLength(24)
    expect(specs.map((spec) => spec.midi)).toEqual(
      Array.from({ length: 24 }, (_, i) => 60 + i),
    )
  })

  it('gives every pitch a unique scientific-pitch id', () => {
    const ids = noteSpecs().map((spec) => spec.id)

    expect(ids.slice(0, 3)).toEqual(['C4', 'C♯4', 'D4'])
    expect(ids.slice(-2)).toEqual(['B♭5', 'B5'])
    expect(new Set(ids).size).toBe(24)
    expect(noteSpecs().map((spec) => spec.octave)).toEqual([
      ...Array.from({ length: 12 }, () => 4),
      ...Array.from({ length: 12 }, () => 5),
    ])
  })

  it('leaves the twelve committed URLs exactly where they were', () => {
    const base = noteSpecs().filter((spec) => spec.octave === 4)

    expect(base.map((spec) => spec.audioSrc)).toEqual([
      '/notes/note-c.mp3',
      '/notes/note-c-sharp.mp3',
      '/notes/note-d.mp3',
      '/notes/note-e-flat.mp3',
      '/notes/note-e.mp3',
      '/notes/note-f.mp3',
      '/notes/note-f-sharp.mp3',
      '/notes/note-g.mp3',
      '/notes/note-a-flat.mp3',
      '/notes/note-a.mp3',
      '/notes/note-b-flat.mp3',
      '/notes/note-b.mp3',
    ])
  })

  it('names every file in lowercase ASCII under /notes', () => {
    for (const spec of noteSpecs()) {
      expect(spec.audioSrc, spec.id).toMatch(/^\/notes\/note-[a-z0-9-]+\.mp3$/)
    }
  })
})

describe('the reference notes are answers, not performances', () => {
  function watch(real: SamplePack): {
    pack: SamplePack
    asked: { voice: VoiceName; velocity: number; index: number; midi?: number }[]
  } {
    const asked: { voice: VoiceName; velocity: number; index: number; midi?: number }[] = []
    return {
      asked,
      pack: {
        ...real,
        get(voice: VoiceName, opts) {
          asked.push({ voice, velocity: opts.velocity, index: opts.index, midi: opts.midi })
          return real.get(voice, opts)
        },
      },
    }
  }

  it('strikes all twenty-four at one velocity, once each — R12', () => {
    const { pack: watched, asked } = watch(pack)
    const rotations = new Set<number>()

    for (const spec of noteSpecs()) {
      asked.length = 0
      renderNote(watched, spec.midi, SAMPLE_RATE)

      expect(asked.length, `${spec.id} is more than one strike`).toBe(1)
      expect(asked[0].voice, spec.id).toBe('comp')
      expect(asked[0].midi, spec.id).toBe(spec.midi)
      rotations.add(asked[0].index)
    }

    expect(
      rotations.size,
      `the twenty-four enter the rotation at ${[...rotations].join(', ')}`,
    ).toBe(1)
  })

  it('asks for the same velocity whichever pitch it is — R12, R14', () => {
    const { pack: watched, asked } = watch(pack)
    for (const spec of noteSpecs()) renderNote(watched, spec.midi, SAMPLE_RATE)

    const velocities = new Set(asked.map((request) => request.velocity))
    expect(asked.length).toBe(noteSpecs().length)
    expect(velocities.size, `the twenty-four are struck at ${[...velocities].join(', ')}`).toBe(1)
  })

  it('renders the same PCM twice for every pitch — R12, R28', () => {
    for (const spec of noteSpecs()) {
      const first = renderNote(pack, spec.midi, SAMPLE_RATE)
      const second = renderNote(pack, spec.midi, SAMPLE_RATE)
      expect(Array.from(second.left), spec.id).toEqual(Array.from(first.left))
      expect(Array.from(second.right), spec.id).toEqual(Array.from(first.right))
    }
  })

  function fundamentalHz(pcm: { left: Float32Array; sampleRate: number }): number {
    const from = Math.round(0.15 * pcm.sampleRate)
    const window = pcm.left.subarray(from, from + Math.round(0.25 * pcm.sampleRate))
    const shortest = Math.floor(pcm.sampleRate / 1200)
    const longest = Math.ceil(pcm.sampleRate / 80)

    const scores = new Float64Array(longest + 2)
    for (let lag = shortest; lag <= longest; lag += 1) {
      let product = 0
      let here = 0
      let there = 0
      for (let i = 0; i + lag < window.length; i += 1) {
        product += window[i] * window[i + lag]
        here += window[i] * window[i]
        there += window[i + lag] * window[i + lag]
      }
      scores[lag] = product / Math.sqrt(here * there + 1e-30)
    }

    let best = shortest
    for (let lag = shortest; lag <= longest; lag += 1) if (scores[lag] > scores[best]) best = lag

    let chosen = best
    for (let lag = shortest + 1; lag < longest; lag += 1) {
      const isPeak = scores[lag] > scores[lag - 1] && scores[lag] >= scores[lag + 1]
      if (isPeak && scores[lag] >= scores[best] * 0.95) {
        chosen = lag
        break
      }
    }

    const above = scores[chosen - 1] ?? scores[chosen]
    const below = scores[chosen + 1] ?? scores[chosen]
    const curvature = above - 2 * scores[chosen] + below
    const shift = curvature === 0 ? 0 : (above - below) / (2 * curvature)
    return pcm.sampleRate / (chosen + Math.max(-1, Math.min(1, shift)))
  }

  const midiOfHz = (hz: number) => 12 * Math.log2(hz / 440) + 69

  const MEASURED: Record<string, { hz: number; peak: number }> = {
    C4: { hz: 262.25, peak: 0.891 },
    'C♯4': { hz: 277.88, peak: 0.8909 },
    D4: { hz: 294.39, peak: 0.8909 },
    'E♭4': { hz: 311.85, peak: 0.891 },
    E4: { hz: 330.34, peak: 0.891 },
    F4: { hz: 350.0, peak: 0.8908 },
    'F♯4': { hz: 370.79, peak: 0.8908 },
    G4: { hz: 392.74, peak: 0.8909 },
    'A♭4': { hz: 416.6, peak: 0.8904 },
    A4: { hz: 441.32, peak: 0.8904 },
    'B♭4': { hz: 467.43, peak: 0.8909 },
    B4: { hz: 495.27, peak: 0.8902 },
    C5: { hz: 525.06, peak: 0.891 },
    'C♯5': { hz: 556.56, peak: 0.8909 },
    D5: { hz: 589.51, peak: 0.891 },
    'E♭5': { hz: 624.51, peak: 0.891 },
    E5: { hz: 661.57, peak: 0.891 },
    F5: { hz: 700.87, peak: 0.8904 },
    'F♯5': { hz: 742.7, peak: 0.8905 },
    G5: { hz: 786.78, peak: 0.8905 },
    'A♭5': { hz: 836.36, peak: 0.8908 },
    A5: { hz: 886.07, peak: 0.8908 },
    'B♭5': { hz: 937.4, peak: 0.891 },
    B5: { hz: 994.01, peak: 0.8907 },
  }

  const HALF_A_SEMITONE = 0.5

  const hzTolerance = (octave: number) => (octave === 4 ? 0.5 : 1)

  it('sounds the pitch it names, at the length and peak committed for it — R13, R13a, AC12', () => {
    for (const spec of noteSpecs()) {
      const note = renderNote(pack, spec.midi, SAMPLE_RATE)
      const committed = MEASURED[spec.id]
      expect(committed, `${spec.id} has no measured value committed`).toBeDefined()

      expect(note.left.length, spec.id).toBe(Math.round(NOTE_SECONDS * SAMPLE_RATE))
      expect(peakOver(note, 0, note.left.length), spec.id).toBeCloseTo(committed.peak, 3)

      const hz = fundamentalHz(note)
      expect(
        Math.abs(hz - committed.hz),
        `${spec.id} was measured at ${hz.toFixed(2)} Hz, committed ${committed.hz}`,
      ).toBeLessThan(hzTolerance(spec.octave))
      expect(
        Math.abs(midiOfHz(hz) - spec.midi),
        `${spec.id} sounds ${midiOfHz(hz).toFixed(2)} where it claims ${spec.midi}`,
      ).toBeLessThan(HALF_A_SEMITONE)
    }
  })

  it('treats all twenty-four identically — R14, R26, AC11', () => {
    const measured = noteSpecs().map((spec) => {
      const note = renderNote(pack, spec.midi, SAMPLE_RATE)
      return {
        id: spec.id,
        frames: note.left.length,
        peak: peakOver(note, 0, note.left.length),
      }
    })

    expect(measured).toHaveLength(24)
    expect(
      new Set(measured.map((note) => note.frames)).size,
      'the twenty-four differ in length',
    ).toBe(1)
    expect(measured[0].frames).toBe(Math.round(NOTE_SECONDS * SAMPLE_RATE))

    const peaks = measured.map((note) => note.peak)
    const loudest = Math.max(...peaks)
    const quietest = Math.min(...peaks)
    expect(loudest - quietest, `peaks run ${quietest} to ${loudest}`).toBeLessThan(0.001)
  })
})
