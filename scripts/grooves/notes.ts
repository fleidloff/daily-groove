import type { Root } from '../../src/lib/groove.ts'
import { mixTracks } from './mix.ts'
import { ROOTS, midiOf } from '../../src/lib/theory/roots.ts'
import type { FeelTemplate, NoteEvent, Pcm, SamplePack } from './types.ts'
import { renderVoices } from './voices.ts'

export const NOTE_SECONDS = 2.0

export const RELEASE_SECONDS = 0.15

export const BASE_OCTAVE = 4

export const NOTE_OCTAVES = [4, 5] as const

const NOTE_VELOCITY = 0.85

const NOTE_TEMPLATE: FeelTemplate = {
  id: 'reference-note',
  tempoRange: [96, 96],
  subdivision: 4,
  swing: 0,
  flavours: [],
  voices: ['comp'],
  humanize: { timingMs: 0, velocity: 0, lean: {}, driftDepth: 0 },
  gain: {},
  pan: {},
  passes: 1,
  density: { minPerBar: 0, maxPerBar: 1 },
}

export type ReferenceNote = {
  id: string
  root: Root
  octave: number
  audioSrc: string
  midi: number
}

export function noteFileName(root: Root, octave: number): string {
  const slug = root.toLowerCase().replace(/♯/g, '-sharp').replace(/♭/g, '-flat')
  const suffix = octave === BASE_OCTAVE ? '' : `-${octave}`
  return `note-${slug}${suffix}.mp3`
}

export function noteSpecs(): ReferenceNote[] {
  return NOTE_OCTAVES.flatMap((octave) =>
    ROOTS.map((root) => ({
      id: `${root}${octave}`,
      root,
      octave,
      audioSrc: `/notes/${noteFileName(root, octave)}`,
      midi: midiOf(root, octave),
    })),
  )
}

export function renderNote(pack: SamplePack, midi: number, sampleRate: number): Pcm {
  const event: NoteEvent = {
    voice: 'comp',
    timeSec: 0,
    durationSec: NOTE_SECONDS,
    velocity: NOTE_VELOCITY,
    midi,
  }

  const tracks = renderVoices([event], pack, sampleRate)
  const master = mixTracks(tracks, NOTE_TEMPLATE)

  const frames = Math.round(NOTE_SECONDS * sampleRate)
  return {
    sampleRate,
    left: release(truncate(master.left, frames), sampleRate),
    right: release(truncate(master.right, frames), sampleRate),
  }
}

function truncate(channel: Float32Array, frames: number): Float32Array {
  if (channel.length === frames) return channel
  const cut = new Float32Array(frames)
  cut.set(channel.subarray(0, Math.min(frames, channel.length)))
  return cut
}

function release(channel: Float32Array, sampleRate: number): Float32Array {
  const total = channel.length
  const ramp = Math.min(total, Math.max(2, Math.round(RELEASE_SECONDS * sampleRate)))
  const from = total - ramp

  for (let i = from; i < total; i += 1) {
    channel[i] *= (total - 1 - i) / (ramp - 1)
  }

  return channel
}
