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
 *
 * Feature-9's Epic 4 gives the stage the two things a sample player needs
 * before an arrangement stops sounding like a pattern: a note that stops when
 * its `durationSec` runs out, and a closed hat that stops a ringing open one.
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

/**
 * The most a layer may be scaled up to stand in for a louder hit.
 *
 * A nominal is the midpoint of its band, so the honest ceiling is 2: a hit at
 * the very top of the lowest band asks its layer for twice the level it was
 * recorded at. A pack that declares its own `nominalVelocity` can ask for more
 * than that, and this is what stops a very quiet layer being scaled into
 * distortion when it does.
 */
const MAX_LAYER_GAIN = 2

/**
 * How long a note takes to fall silent once its duration has run out.
 *
 * A duration used to be decoration: `addAt` copied the whole sample whatever
 * the event said, so nothing had an ending. Cutting at the duration exactly
 * would give it one, and a click with it — a waveform stopped mid-cycle is a
 * step, and a step is a broadband transient. Eight milliseconds is long enough
 * for the discontinuity to fall below what the ear picks out and short enough
 * that the note still reads as stopping rather than fading.
 *
 * It is a stop, not an envelope. Shaping a note's decay is the sample's job.
 */
const RELEASE_SEC = 0.008

/**
 * How long a closed hat takes to silence a ringing open one.
 *
 * Shorter than a note's release, because a choke is a physical event — the foot
 * closes on the cymbal and the ring stops — rather than a note ending. Five
 * milliseconds still costs nothing in clicks, because the closed hat's own
 * attack lands on top of it and masks whatever the fade leaves behind.
 */
const CHOKE_SEC = 0.005

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

/**
 * A closed hi-hat stops a ringing open one.
 *
 * This is the one thing the voices stage does that a single event cannot say
 * for itself, so it is a pass over the finished tracks rather than a rule on
 * the events: an open hat is placed in full, and every closed hat that lands
 * while it is still ringing wipes what is left of it.
 *
 * Deliberately a property of these two voices and not a general choke-group
 * mechanism on the template. A hat pedal is the only choke a kit of seven
 * voices has, and a template field for it would be a configuration point with
 * exactly one correct setting.
 *
 * The silence runs from the closed hat up to the next open hat, not to the end
 * of the buffer. An open hat struck after the pedal closed is a new sound, and
 * a choke that ran past it would delete a note nobody played over.
 */
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

/**
 * How loud to play the layer the pack handed back.
 *
 * The layers are deliberately not normalised: the one chosen for a velocity was
 * recorded at that kind of velocity and already carries its loudness. Scaling
 * it by the raw velocity on top of that applies the dynamics twice - it squares
 * the range, and it puts an audible step at every layer boundary, where a hit
 * just over the line jumps to a louder recording that is then scaled by very
 * nearly the same number. Hi-hats, which sit right on a boundary and flip layer
 * from hit to hit, wore it worst.
 *
 * So the gain is relative to what the layer represents: 1 at the centre of its
 * band, above it towards the top, below it towards the bottom. The two sides of
 * a boundary then meet, and velocity moves the level once.
 *
 * A pack that reports no usable nominal falls back to the raw velocity, which
 * is at least the behaviour every pack had before.
 */
function gainFor(velocity: number, nominalVelocity: number | undefined): number {
  if (nominalVelocity === undefined || !Number.isFinite(nominalVelocity) || nominalVelocity <= 0) {
    return velocity
  }
  return Math.min(velocity / nominalVelocity, MAX_LAYER_GAIN)
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

/**
 * Adds `source` into `target` at `offset`, scaled by `gain`, clipped at the end.
 *
 * With `durationSec`, the note also has an ending: the sample plays at full
 * gain for that long and then falls to silence over `RELEASE_SEC`. A sample
 * shorter than the duration is unaffected, which is why the drums barely notice
 * — their declared durations already outrun their recordings — and the comp and
 * the bass, whose samples ring for the best part of a second, are where this is
 * the whole difference between a chord that ends and one that does not.
 *
 * Omitting the argument keeps the old behaviour of copying the whole sample.
 */
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
