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
import { ROOTS } from './theory/notes.ts'
import type { SamplePack, VoiceName } from './types.ts'

const SAMPLE_RATE = 44100
const PACK_DIR = join(import.meta.dirname, 'samples')

let pack: SamplePack

beforeAll(async () => {
  pack = await loadPack(PACK_DIR)
}, 120_000)

/** The largest absolute sample over a half-open frame range, both channels. */
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

  // AC15: the render is a pure function of the pack, so two runs agree sample
  // for sample and the encoded files are byte-identical.
  it('renders the same samples every time', () => {
    const first = renderNote(pack, 60, SAMPLE_RATE)
    const second = renderNote(pack, 60, SAMPLE_RATE)

    expect(Array.from(second.left)).toEqual(Array.from(first.left))
    expect(Array.from(second.right)).toEqual(Array.from(first.right))
  })

  // R4, AC20: a note that ends on a step is a click, and a note cut at the
  // groove's level is a note that never ends.
  it('ends on silence', () => {
    const note = renderNote(pack, 60, SAMPLE_RATE)
    const last = note.left.length - 1

    // `Math.abs`, because a channel that ends on a negative sample ramps down
    // to -0 — the same silence, and not the assertion's subject.
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

  // R8, AC20: every note is normalised by the same mix stage, so no root
  // arrives louder than its neighbour.
  it('gives every root the same length and the same peak', () => {
    const peaks = ROOTS.map((root, i) => {
      const note = renderNote(pack, 60 + i, SAMPLE_RATE)
      expect(note.left.length).toBe(Math.round(NOTE_SECONDS * SAMPLE_RATE))
      return peakOver(note, 0, note.left.length)
    })

    const loudest = Math.max(...peaks)
    const quietest = Math.min(...peaks)
    // Within 1 dB, which is the PRD's own number for "no root stands out".
    expect(20 * Math.log10(loudest / quietest)).toBeLessThan(1)
  })
})

describe('noteFileName', () => {
  it('spells an accidental in ASCII', () => {
    expect(noteFileName('C', 4)).toBe('note-c.mp3')
    expect(noteFileName('C♯', 4)).toBe('note-c-sharp.mp3')
    expect(noteFileName('E♭', 4)).toBe('note-e-flat.mp3')
  })

  // R27: the base octave keeps the bare names it shipped with, so widening the
  // render adds twelve files and moves none. Only the octave above is suffixed.
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

  // R26: two octaves, C4 up to B5 — the range a lick from any root can reach,
  // because a phrase's top is its root (60..71) plus an octave.
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

  // R27, AC17: the twelve URLs the committed manifest and the committed lock
  // already carry, asserted as literals rather than derived — a derivation
  // would move with the code that broke them.
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

/**
 * Feature-13, Epic 4, Track C — R12, R13, R13a, R14, AC11, AC12.
 *
 * The comp was given a velocity curve, and the reference notes are the same
 * voice. They must not have got one: a player taps a root chip to hear the
 * answer, not a performance. `notes.ts` builds a degenerate template with no
 * feel and renders a single event, so no accent cycle and no pass index can
 * reach them — and asserting that is what stops it being an accident rather
 * than a decision.
 *
 * The twelve are pinned on what they measure — length, peak and sounding pitch
 * — and not on a byte hash. A hash says the output has not changed without
 * saying what about it was right, and it would fail on any unrelated re-encode.
 */
describe('the reference notes are answers, not performances', () => {
  /**
   * Every request the render made of the pack, so what reached the sample
   * player can be read rather than inferred.
   */
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

  // Step C1 — R12
  it('strikes all twenty-four at one velocity, once each — R12', () => {
    const { pack: watched, asked } = watch(pack)
    const rotations = new Set<number>()

    for (const spec of noteSpecs()) {
      asked.length = 0
      renderNote(watched, spec.midi, SAMPLE_RATE)

      // One event, so one request. A chord would be several, and an accent
      // cycle indexed by position in a sequence needs a sequence to index.
      expect(asked.length, `${spec.id} is more than one strike`).toBe(1)
      expect(asked[0].voice, spec.id).toBe('comp')
      expect(asked[0].midi, spec.id).toBe(spec.midi)
      rotations.add(asked[0].index)
    }

    // And the row does not rotate through the pack either. Each note is its own
    // render, so each enters `roundRobin` at the same seeded offset — which is
    // why the comp's single alternate per layer is enough for a reference note
    // and would not be enough for a performance.
    expect(
      rotations.size,
      `the twenty-four enter the rotation at ${[...rotations].join(', ')}`,
    ).toBe(1)
  })

  // R7, R26: one velocity for both octaves. `NOTE_VELOCITY` is global to
  // `renderNote` and must stay that way — a per-octave value would have to be a
  // branch, and a branch would move the twelve committed files' bytes (R27).
  it('asks for the same velocity whichever pitch it is — R12, R14', () => {
    const { pack: watched, asked } = watch(pack)
    for (const spec of noteSpecs()) renderNote(watched, spec.midi, SAMPLE_RATE)

    const velocities = new Set(asked.map((request) => request.velocity))
    expect(asked.length).toBe(noteSpecs().length)
    expect(velocities.size, `the twenty-four are struck at ${[...velocities].join(', ')}`).toBe(1)
  })

  it('renders the same PCM twice for every pitch — R12, R28', () => {
    // Determinism for all twenty-four rather than for middle C alone: the curve
    // is a function of a pass index, and a pass index that leaked in here would
    // show up as a second call rendering differently from the first.
    for (const spec of noteSpecs()) {
      const first = renderNote(pack, spec.midi, SAMPLE_RATE)
      const second = renderNote(pack, spec.midi, SAMPLE_RATE)
      expect(Array.from(second.left), spec.id).toEqual(Array.from(first.left))
      expect(Array.from(second.right), spec.id).toEqual(Array.from(first.right))
    }
  })

  /**
   * The fundamental of a window past the attack, in Hz.
   *
   * Normalised autocorrelation, then the SMALLEST lag among the local maxima
   * that score within 5 % of the best. Both halves matter. A plain argmax lands
   * on whichever multiple of the period correlates best and reads a note an
   * octave or two low; the first local maximum over a loose threshold lands on
   * the half-period the second harmonic leaves behind and reads middle C an
   * octave high, which is what this measurement did before the 5 % was
   * tightened. Only the near-ties are candidates, and among those the shortest
   * period is the fundamental.
   *
   * `samples/README.md` is the reason this is measured at all: a sounding pitch
   * is measured, never read off a name. The pack's own declaration was
   * established the same way.
   */
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

    // Parabolic refinement, so the answer is not quantised to whole frames: at
    // 262 Hz one frame of lag is six cents, which is wider than the tolerance
    // the pin below is asserted to.
    const above = scores[chosen - 1] ?? scores[chosen]
    const below = scores[chosen + 1] ?? scores[chosen]
    const curvature = above - 2 * scores[chosen] + below
    const shift = curvature === 0 ? 0 : (above - below) / (2 * curvature)
    return pcm.sampleRate / (chosen + Math.max(-1, Math.min(1, shift)))
  }

  /** The MIDI note a frequency sounds, as a real number. */
  const midiOfHz = (hz: number) => 12 * Math.log2(hz / 440) + 69

  /**
   * What the twenty-four measure, rendered through the comp path and committed
   * as the intended result (R13, R26, AC12).
   *
   * **Keyed by scientific pitch, not by root.** With two octaves a root is no
   * longer unique, and a table keyed by root would compare every octave-5 spec
   * against its octave-4 neighbour's frequency — the wrong number, silently,
   * for half the set.
   *
   * The pitches are the piano's own, not equal temperament's: the pack is a
   * sampled upright and is stretched as a real one is. Octave 4 sits about four
   * cents above nominal; the upper octave drifts to about twelve cents by A♭5,
   * which is the same stretch inherited through the resample and not an error —
   * a 4× margin still on the half-semitone assertion below. The peak is the mix
   * stage's — `mixTracks` normalises every master onto `PEAK_CEILING`, which is
   * why all twenty-four arrive within a whisker of 0.891 whatever velocity
   * struck them.
   */
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

  /** Half a semitone, the tolerance `pack.test.ts` measures a sounding pitch to. */
  const HALF_A_SEMITONE = 0.5

  /**
   * How close the measured fundamental must sit to the committed one.
   *
   * The base octave keeps the half-Hz it was committed to. The upper octave is
   * pinned to a whole Hz, because up there the pin is carried almost entirely
   * by the parabolic refinement: at 994 Hz the autocorrelation's lag grid is
   * ~39 cents per frame, so half a Hz — 0.9 cents — is a demand on the
   * interpolation rather than on the render. One Hz is 1.7 cents at the top of
   * the range, still far tighter than any change worth catching, and the
   * `midiOfHz` assertion below stays the actual musical guard either way.
   */
  const hzTolerance = (octave: number) => (octave === 4 ? 0.5 : 1)

  // Step C2 / Step A3 — R13, R13a, R26, AC12
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
      // And the committed frequency is the pitch the chip claims, measured
      // rather than read off the name it is filed under.
      expect(
        Math.abs(midiOfHz(hz) - spec.midi),
        `${spec.id} sounds ${midiOfHz(hz).toFixed(2)} where it claims ${spec.midi}`,
      ).toBeLessThan(HALF_A_SEMITONE)
    }
  })

  // Step C3 / Step A3 — R7, R14, R26, R28, AC11
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
    // Every one is exactly NOTE_SECONDS: the worst upward transposition in the
    // upper octave is +2 semitones off a 2.5 s source, so nothing up there is
    // zero-padded and the truncation is what sets the length for all of them.
    expect(
      new Set(measured.map((note) => note.frames)).size,
      'the twenty-four differ in length',
    ).toBe(1)
    expect(measured[0].frames).toBe(Math.round(NOTE_SECONDS * SAMPLE_RATE))

    const peaks = measured.map((note) => note.peak)
    const loudest = Math.max(...peaks)
    const quietest = Math.min(...peaks)
    // Within a thousandth of full scale — far tighter than the 1 dB the PRD
    // asks for, because every one of them is normalised by the same mix stage.
    // It is what fails if someone later gives the reference notes a curve.
    //
    // Peak, and only peak. Widening did not widen this spread at all, but it
    // did widen loudness: RMS runs about 7.8 dB across the twenty-four because
    // the pack's higher recordings are genuinely more transient. That is the
    // instrument's register behaviour and is deliberately not compensated here
    // — see the module comment in `notes.ts`.
    expect(loudest - quietest, `peaks run ${quietest} to ${loudest}`).toBeLessThan(0.001)
  })
})
