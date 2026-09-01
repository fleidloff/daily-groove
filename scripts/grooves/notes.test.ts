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
    expect(noteFileName('C')).toBe('note-c.mp3')
    expect(noteFileName('C♯')).toBe('note-c-sharp.mp3')
    expect(noteFileName('E♭')).toBe('note-e-flat.mp3')
  })
})

describe('noteSpecs', () => {
  it('covers every root, in ROOTS order', () => {
    expect(noteSpecs().map((spec) => spec.root)).toEqual(ROOTS)
  })

  // R7: one fixed register, C4 up to B4.
  it('numbers them 60 to 71', () => {
    expect(noteSpecs().map((spec) => spec.midi)).toEqual([
      60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71,
    ])
  })

  it('names every file in lowercase ASCII under /notes', () => {
    for (const spec of noteSpecs()) {
      expect(spec.audioSrc).toMatch(/^\/notes\/note-[a-z-]+\.mp3$/)
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
  it('strikes all twelve at one velocity, once each — R12', () => {
    const { pack: watched, asked } = watch(pack)
    const rotations = new Set<number>()

    for (const spec of noteSpecs()) {
      asked.length = 0
      renderNote(watched, spec.midi, SAMPLE_RATE)

      // One event, so one request. A chord would be several, and an accent
      // cycle indexed by position in a sequence needs a sequence to index.
      expect(asked.length, `${spec.root} is more than one strike`).toBe(1)
      expect(asked[0].voice, spec.root).toBe('comp')
      expect(asked[0].midi, spec.root).toBe(spec.midi)
      rotations.add(asked[0].index)
    }

    // And the row does not rotate through the pack either. Each note is its own
    // render, so each enters `roundRobin` at the same seeded offset — which is
    // why the comp's single alternate per layer is enough for a reference note
    // and would not be enough for a performance.
    expect(rotations.size, `the twelve enter the rotation at ${[...rotations].join(', ')}`).toBe(1)
  })

  it('asks for the same velocity whichever root it is — R12, R14', () => {
    const { pack: watched, asked } = watch(pack)
    for (const spec of noteSpecs()) renderNote(watched, spec.midi, SAMPLE_RATE)

    const velocities = new Set(asked.map((request) => request.velocity))
    expect(asked.length).toBe(noteSpecs().length)
    expect(velocities.size, `the twelve are struck at ${[...velocities].join(', ')}`).toBe(1)
  })

  it('renders the same PCM twice for every root — R12', () => {
    // Determinism for all twelve rather than for middle C alone: the curve is a
    // function of a pass index, and a pass index that leaked in here would show
    // up as a second call rendering differently from the first.
    for (const spec of noteSpecs()) {
      const first = renderNote(pack, spec.midi, SAMPLE_RATE)
      const second = renderNote(pack, spec.midi, SAMPLE_RATE)
      expect(Array.from(second.left), spec.root).toEqual(Array.from(first.left))
      expect(Array.from(second.right), spec.root).toEqual(Array.from(first.right))
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
   * What the twelve measure, rendered through the changed comp path and
   * committed as the intended result (R13, AC12).
   *
   * The pitches are the piano's own, not equal temperament's: the pack is a
   * sampled upright and is stretched as a real one is, and the four cents each
   * of these sits above its nominal is the instrument. The peak is the mix
   * stage's — `mixTracks` normalises every master onto `PEAK_CEILING`, which is
   * why all twelve arrive within a whisker of 0.891 whatever velocity struck
   * them, and why the curve could not have moved this number even if it had
   * reached in here.
   */
  const MEASURED: Record<string, { hz: number; peak: number }> = {
    C: { hz: 262.25, peak: 0.891 },
    'C♯': { hz: 277.88, peak: 0.8909 },
    D: { hz: 294.39, peak: 0.8909 },
    'E♭': { hz: 311.85, peak: 0.891 },
    E: { hz: 330.34, peak: 0.891 },
    F: { hz: 350.0, peak: 0.8908 },
    'F♯': { hz: 370.79, peak: 0.8908 },
    G: { hz: 392.74, peak: 0.8909 },
    'A♭': { hz: 416.6, peak: 0.8904 },
    A: { hz: 441.32, peak: 0.8904 },
    'B♭': { hz: 467.43, peak: 0.8909 },
    B: { hz: 495.27, peak: 0.8902 },
  }

  /** Half a semitone, the tolerance `pack.test.ts` measures a sounding pitch to. */
  const HALF_A_SEMITONE = 0.5

  // Step C2 — R13, R13a, AC12
  it('sounds the pitch it names, at the length and peak committed for it — R13, R13a, AC12', () => {
    for (const spec of noteSpecs()) {
      const note = renderNote(pack, spec.midi, SAMPLE_RATE)
      const committed = MEASURED[spec.root]
      expect(committed, `${spec.root} has no measured value committed`).toBeDefined()

      expect(note.left.length, spec.root).toBe(Math.round(NOTE_SECONDS * SAMPLE_RATE))
      expect(peakOver(note, 0, note.left.length), spec.root).toBeCloseTo(committed.peak, 3)

      const hz = fundamentalHz(note)
      expect(hz, `${spec.root} was measured at ${hz.toFixed(2)} Hz`).toBeCloseTo(committed.hz, 0)
      // And the committed frequency is the pitch the chip claims, measured
      // rather than read off the name it is filed under.
      expect(
        Math.abs(midiOfHz(hz) - spec.midi),
        `${spec.root} sounds ${midiOfHz(hz).toFixed(2)} where it claims ${spec.midi}`,
      ).toBeLessThan(HALF_A_SEMITONE)
    }
  })

  // Step C3 — R14, AC11
  it('treats all twelve identically — R14, AC11', () => {
    const measured = noteSpecs().map((spec) => {
      const note = renderNote(pack, spec.midi, SAMPLE_RATE)
      return {
        root: spec.root,
        frames: note.left.length,
        peak: peakOver(note, 0, note.left.length),
      }
    })

    expect(new Set(measured.map((note) => note.frames)).size, 'the twelve differ in length').toBe(1)

    const peaks = measured.map((note) => note.peak)
    const loudest = Math.max(...peaks)
    const quietest = Math.min(...peaks)
    // Within a thousandth of full scale — far tighter than the 1 dB the PRD
    // asks for, because every one of them is normalised by the same mix stage.
    // It is what fails if someone later gives the reference notes a curve.
    expect(loudest - quietest, `peaks run ${quietest} to ${loudest}`).toBeLessThan(0.001)
  })
})
