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
import type { SamplePack } from './types.ts'

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
