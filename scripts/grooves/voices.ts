import { rngFor } from './rng.ts'
import type { NoteEvent, Pcm, SamplePack, Track, VoiceName } from './types.ts'

const BEATS_PER_BAR = 4

const ROUND_ROBIN_SPAN = 64

const MAX_LAYER_GAIN = 2

const RELEASE_SEC = 0.008

const CHOKE_SEC = 0.005

export type RenderOptions = {
  id?: string
  bars?: number
  bpm?: number
  overhangBars?: number
  passes?: number
}

export function renderVoices(
  events: NoteEvent[],
  pack: SamplePack,
  sampleRate: number,
  options: RenderOptions = {},
): Track[] {
  if (events.length === 0) return []

  const frames = frameCount(events, sampleRate, options)
  const tracks = new Map<VoiceName, Track>()
  const nextAlternate = roundRobin(`${options.id ?? pack.id}:rr`)
  const passOf = passIndexer(options)

  for (const event of events) {
    let track = tracks.get(event.voice)
    if (!track) {
      track = {
        voice: event.voice,
        pcm: {
          sampleRate,
          left: new Float32Array(frames),
          right: new Float32Array(frames),
        },
      }
      tracks.set(event.voice, track)
    }

    const sample = pack.get(event.voice, {
      velocity: event.velocity,
      index: nextAlternate(event.voice, passOf(event.timeSec)),
      midi: event.midi,
    })
    if (!sample) continue

    const source = transpose(sample.pcm, event.midi, sample.rootMidi)
    const offset = Math.round(event.timeSec * sampleRate)

    addAt(
      track.pcm,
      source,
      offset,
      gainFor(event.velocity, sample.nominalVelocity),
      event.durationSec,
    )
  }

  chokeOpenHats(tracks, events, sampleRate)

  return [...tracks.values()]
}

function chokeOpenHats(
  tracks: Map<VoiceName, Track>,
  events: NoteEvent[],
  sampleRate: number,
): void {
  const open = tracks.get('hatOpen')
  if (!open) return

  const onsets = (voice: VoiceName) =>
    events
      .filter((event) => event.voice === voice)
      .map((event) => event.timeSec)
      .sort((a, b) => a - b)

  const closed = onsets('hatClosed')
  if (closed.length === 0) return
  const opened = onsets('hatOpen')

  const frames = open.pcm.left.length
  const fade = Math.max(1, Math.round(CHOKE_SEC * sampleRate))

  for (const timeSec of closed) {
    const from = Math.max(0, Math.round(timeSec * sampleRate))
    if (from >= frames) continue

    const next = opened.find((onset) => onset >= timeSec)
    const until = next === undefined ? frames : Math.min(frames, Math.round(next * sampleRate))

    for (let i = from; i < until; i += 1) {
      const elapsed = i - from
      const level = elapsed < fade ? 1 - elapsed / fade : 0
      open.pcm.left[i] *= level
      open.pcm.right[i] *= level
    }
  }
}

function gainFor(velocity: number, nominalVelocity: number | undefined): number {
  if (nominalVelocity === undefined || !Number.isFinite(nominalVelocity) || nominalVelocity <= 0) {
    return velocity
  }
  return Math.min(velocity / nominalVelocity, MAX_LAYER_GAIN)
}

function roundRobin(label: string): (voice: VoiceName, pass: number) => number {
  const rng = rngFor(label)
  const starts = new Map<VoiceName, number>()
  const counts = new Map<string, number>()

  return (voice, pass) => {
    let start = starts.get(voice)
    if (start === undefined) {
      start = Math.floor(rng() * ROUND_ROBIN_SPAN)
      starts.set(voice, start)
    }

    const key = `${voice}:${pass}`
    const played = counts.get(key) ?? 0
    counts.set(key, played + 1)
    return start + pass + played
  }
}

function passIndexer(options: RenderOptions): (timeSec: number) => number {
  const { bars, bpm, passes } = options
  if (bars === undefined || bpm === undefined || !passes || passes < 2) return () => 0

  const passSec = ((bars / passes) * BEATS_PER_BAR * 60) / bpm
  if (!Number.isFinite(passSec) || passSec <= 0) return () => 0

  return (timeSec) => Math.max(0, Math.min(passes - 1, Math.floor(timeSec / passSec)))
}

function frameCount(events: NoteEvent[], sampleRate: number, options: RenderOptions): number {
  const { bars, bpm } = options

  if (bars !== undefined && bpm !== undefined) {
    const secPerBar = (BEATS_PER_BAR * 60) / bpm
    const total = (bars + (options.overhangBars ?? 0)) * secPerBar
    return Math.max(1, Math.round(total * sampleRate))
  }

  let end = 0
  for (const event of events) {
    end = Math.max(end, event.timeSec + event.durationSec)
  }
  return Math.max(1, Math.ceil(end * sampleRate))
}

function transpose(pcm: Pcm, midi: number | undefined, rootMidi: number | undefined): Pcm {
  if (midi === undefined || rootMidi === undefined || midi === rootMidi) return pcm
  return resample(pcm, 2 ** ((midi - rootMidi) / 12))
}

export function resample(pcm: Pcm, ratio: number): Pcm {
  const frames = Math.max(1, Math.floor(pcm.left.length / ratio))
  const left = new Float32Array(frames)
  const right = new Float32Array(frames)

  for (let i = 0; i < frames; i += 1) {
    const position = i * ratio
    const index = Math.floor(position)
    const fraction = position - index
    const next = Math.min(index + 1, pcm.left.length - 1)

    left[i] = pcm.left[index] + (pcm.left[next] - pcm.left[index]) * fraction
    right[i] = pcm.right[index] + (pcm.right[next] - pcm.right[index]) * fraction
  }

  return { sampleRate: pcm.sampleRate, left, right }
}

export function addAt(
  target: Pcm,
  source: Pcm,
  offset: number,
  gain: number,
  durationSec?: number,
): void {
  const start = Math.max(0, offset)
  const available = target.left.length - start
  if (available <= 0) return

  const held =
    durationSec === undefined
      ? source.left.length
      : Math.max(0, Math.round(durationSec * target.sampleRate))
  const release =
    durationSec === undefined ? 0 : Math.max(1, Math.round(RELEASE_SEC * target.sampleRate))

  const count = Math.min(source.left.length, available, held + release)

  for (let i = 0; i < count; i += 1) {
    const level = i < held ? gain : gain * (1 - (i - held) / release)
    target.left[start + i] += source.left[i] * level
    target.right[start + i] += source.right[i] * level
  }
}
