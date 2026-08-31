/**
 * The voices stage: note events plus a sample pack become one buffer per voice.
 *
 * Pure, and synchronous - the pack hands over already-decoded PCM, so rendering
 * is a function of its inputs and nothing here reads the clock or calls
 * `Math.random`. Round-robin selection is the one choice this stage makes, and
 * it is drawn from `rngFor` so the same groove always renders the same PCM.
 *
 * Epic 2 starts using everything the pack declares: the event's own velocity
 * picks the layer, a per-voice counter rotates the alternates, and the buffer
 * can be sized to the tempo grid plus an overhang so a tail at the end of the
 * loop rings on for the mix stage to wrap back onto the start.
 */

import { rngFor } from './rng.ts'
import type { NoteEvent, Pcm, SamplePack, Track, VoiceName } from './types.ts'

/** 4/4 throughout the feature, as in the events stage. */
const BEATS_PER_BAR = 4

/**
 * How far the seeded start of a round-robin rotation can reach. It is reduced
 * modulo the alternate count by the pack, so any span wider than the largest
 * declared round-robin group will do; 64 is comfortably wider.
 */
const ROUND_ROBIN_SPAN = 64

export type RenderOptions = {
  /**
   * The groove's id. It seeds the round-robin starting offset, so two grooves
   * do not always open on the same alternate. Defaults to the pack's id, which
   * keeps a render without an id deterministic all the same.
   */
  id?: string
  /** Loop length in bars. With `bpm`, the buffer is sized to the grid. */
  bars?: number
  bpm?: number
  /**
   * Extra bars rendered past the loop so decaying samples are not cut off.
   * `mixTracks` sums this region back onto the start. Needs `bars` and `bpm`.
   */
  overhangBars?: number
  /**
   * How many passes of the figure `bars` covers. Used only to keep a pass from
   * replaying its predecessor's round-robin alternates — see `roundRobin`.
   * Needs `bars` and `bpm`. Omitted, every event is treated as pass 0, which
   * is the pre-feature-9 behaviour.
   */
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

    addAt(track.pcm, source, offset, event.velocity)
  }

  return [...tracks.values()]
}

/**
 * A per-voice rotation through a pack's alternates.
 *
 * Each voice gets its own counter, so a snare between two kicks never steals
 * the kick's next alternate, and its own seeded starting offset, so the first
 * hit of a groove is not always the first file on disk. The pack reduces the
 * number modulo the alternates it actually holds.
 *
 * Each pass restarts the count and enters the rotation one step further on,
 * and that is load-bearing rather than decorative. A single running counter
 * repeats: a voice with `N` hits per pass against `F` alternates re-enters
 * pass 1 at `start + N`, which is congruent to `start` whenever `F` divides
 * `N` — the ordinary case, because most voices declare two alternates and play
 * an even number of hits per pass. Before this, the snare of every four-pass
 * groove in the catalogue played the same two files in the same order four
 * times over.
 *
 * Restarting the count is what makes the shift survive. Adding the pass to a
 * running counter only moves the conspiracy — it collides whenever `F` divides
 * `N + 1` — whereas a per-pass count enters at `start + pass` regardless of how
 * many hits a pass holds. Consecutive passes therefore differ by exactly one
 * step, which is never a whole rotation for any alternate count above one.
 *
 * What it cannot do is make every pass differ from every other: with two
 * alternates there are only two sequences to have, so a four-pass groove must
 * reuse one. Adjacent passes are what an ear compares, and those always differ.
 */
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

/**
 * Which pass a moment belongs to, from the options the caller supplied.
 *
 * Without `bars`, `bpm` and `passes` there is nothing to divide by, so every
 * event is pass 0 and the rotation behaves exactly as it did before passes
 * existed. That keeps every Epic 1 caller — and every test that renders a bare
 * event list — unchanged.
 */
function passIndexer(options: RenderOptions): (timeSec: number) => number {
  const { bars, bpm, passes } = options
  if (bars === undefined || bpm === undefined || !passes || passes < 2) return () => 0

  const passSec = ((bars / passes) * BEATS_PER_BAR * 60) / bpm
  if (!Number.isFinite(passSec) || passSec <= 0) return () => 0

  return (timeSec) => Math.max(0, Math.min(passes - 1, Math.floor(timeSec / passSec)))
}

/**
 * With `bars` and `bpm` the buffer is the tempo grid plus any overhang, so a
 * four-bar loop is exactly four bars long however early the last note falls and
 * a tail has somewhere to ring. Without them it spans the events, as Epic 1
 * sized it: the last note's start plus its duration.
 */
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

/**
 * Linear-interpolating resample. `ratio` is playback speed, so 2 reads twice as
 * fast and sounds an octave higher. The pack samples every four semitones, so
 * the shift is never more than two - the range where linear interpolation is
 * transparent, which the pitched-register test asserts against the committed
 * pack. If that ever fails, the fix is more sampled notes, not a better
 * interpolator.
 */
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

/** Adds `source` into `target` at `offset`, scaled by `gain`, clipped at the end. */
export function addAt(target: Pcm, source: Pcm, offset: number, gain: number): void {
  const start = Math.max(0, offset)
  const available = target.left.length - start
  if (available <= 0) return

  const count = Math.min(source.left.length, available)

  for (let i = 0; i < count; i += 1) {
    target.left[start + i] += source.left[i] * gain
    target.right[start + i] += source.right[i] * gain
  }
}
