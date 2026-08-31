/**
 * The feel stage: what turns a grid into a performance.
 *
 * Four pure functions, applied in order by `buildEvents`:
 *
 *   applySwing  — pushes the off-beat subdivisions late (R4)
 *   humanize    — leans each voice, then walks every onset and velocity within
 *                 the bounds the template declares, from the groove's own
 *                 seeded generator (R1-R6)
 *   applyDrift  — lets the tempo breathe within a pass and resolve at its end
 *   fitToLoop   — puts the loop back to exactly the length that was rendered
 *
 * Nothing here reads the clock or calls Math.random: every deviation comes from
 * the `rng` the caller passes in, which is what keeps "the same spec renders the
 * same audio" true after this epic (AC4).
 */

import type { FeelTemplate, NoteEvent, VoiceName } from './types.ts'

/** 4/4 throughout the feature. */
const BEATS_PER_BAR = 4

/**
 * The floor a humanized velocity is clamped to. Zero would mean a silent note,
 * which reads as a dropped note rather than a soft one.
 */
const MIN_VELOCITY = 0.02

/** No event may be shortened below this, so every note still sounds. */
const MIN_DURATION_SEC = 0.005

/** How long one subdivision step lasts at a tempo. */
export function stepSecFor(bpm: number, subdivision: number): number {
  return ((60 / bpm) * BEATS_PER_BAR) / subdivision
}

/**
 * Displace the off-beat subdivisions toward a shuffle, leaving the on-beats
 * exactly where they are.
 *
 * An off-beat is delayed by `swing × half a subdivision`, so `swing: 0` changes
 * nothing and `swing: 1` lands the off-beat halfway to the next step — the
 * furthest it can travel without reading as a different subdivision (R7).
 */
export function applySwing(
  events: NoteEvent[],
  swing: number,
  subdivision: number,
  bpm: number,
): NoteEvent[] {
  if (swing === 0) return events.map((event) => ({ ...event }))

  const stepSec = stepSecFor(bpm, subdivision)
  const delay = clamp(swing, 0, 1) * (stepSec / 2)

  return events.map((event) => {
    const step = Math.round(event.timeSec / stepSec)
    if (step % 2 === 0) return { ...event }
    return { ...event, timeSec: event.timeSec + delay }
  })
}

/**
 * Which series a voice's timing walk is drawn from.
 *
 * A voice not named here walks alone. Kick and bass share one series because a
 * bass line that wanders independently of the kick under it reads as two
 * players rather than one section: deriving the bass's deviation from the
 * kick's is what R5 asks for, and a shared walk is the whole of the mechanism.
 */
const WALK_GROUPS: Partial<Record<VoiceName, string>> = {
  kick: 'low',
  bass: 'low',
}

/**
 * Nudge every event's timing and velocity by a deviation drawn from `rng`,
 * bounded by what the template declares.
 *
 * Timing is three terms, and only the last two are chance:
 *
 *   lean   — the template's constant, signed offset for the voice. The snare
 *            sits behind the beat on every hit, which is what a listener hears
 *            as laid back (R1, R2).
 *   walk   — a bounded random walk per voice group, so hit n+1 starts from near
 *            where hit n landed. Independent draws are jitter; a walk is a
 *            player (R3).
 *   clamp  — applied to lean + walk together, because it is their sum that
 *            displaces the note. Just under half a subdivision, so however
 *            loose a template asks to be, a note is never read as landing on
 *            its neighbour's slot (R6). That clamp needs the tempo; without it
 *            only the template's own millisecond bound applies.
 */
export function humanize(
  events: NoteEvent[],
  template: FeelTemplate,
  rng: () => number,
  bpm?: number,
): NoteEvent[] {
  const { timingMs, velocity, lean } = template.humanize
  const leans = Object.values(lean).filter((ms) => ms !== 0)
  if (timingMs === 0 && velocity === 0 && leans.length === 0) {
    return events.map((event) => ({ ...event }))
  }

  const subdivisionLimit =
    bpm === undefined
      ? Number.POSITIVE_INFINITY
      : // Strictly inside half a step, so the nearest-subdivision reading never ties.
        stepSecFor(bpm, template.subdivision) * 0.49
  const timingBound = Math.min(timingMs / 1000, subdivisionLimit)

  // Where each group's walk currently stands. One entry per group per call, and
  // `humanize` is called once per pass, so every pass is its own take.
  const walks = new Map<string, number>()

  return events.map((event) => {
    const group = WALK_GROUPS[event.voice] ?? event.voice
    const previous = walks.get(group) ?? 0
    const walk = clamp(previous + gaussianUnit(rng) * timingBound, -timingBound, timingBound)
    walks.set(group, walk)

    // The clamp is on the sum: a 15 ms lean and an 11 ms walk are each modest
    // and together are not, and it is what they add up to that displaces the
    // note (R6).
    const leanSec = (lean[event.voice] ?? 0) / 1000
    const displacement = clamp(leanSec + walk, -subdivisionLimit, subdivisionLimit)

    return {
      ...event,
      timeSec: event.timeSec + displacement,
      velocity: clamp(event.velocity + gaussianUnit(rng) * velocity, MIN_VELOCITY, 1),
    }
  })
}

/**
 * Let the tempo breathe within each pass and come back.
 *
 * `depth` is a fractional deviation in *tempo*, so 0.006 is a player running
 * 0.6 % fast and slow across the pass. What an event carries is not that
 * fraction but its integral: a tempo of `depth × cos(2π × phase)` accumulates a
 * position offset of `depth × passSec / 2π × sin(2π × phase)`, which is where
 * the 2π comes from and why it matters. Displacing by `depth × passSec`
 * directly — the obvious reading — is 2π times too much: at 100 bpm that is
 * 48 ms, a third of a sixteenth, which shoves notes clean off the step they
 * were written on and breaks the guarantee `humanize` works to keep.
 *
 * The shape is late through the first half of a pass, early through the second,
 * and exactly zero at every pass boundary by construction. That last part is
 * the point — the pass is the unit of performance, so a wander that resolves
 * every four bars reads as a player breathing rather than as the tape slowing
 * down, and `fitToLoop` is left with nothing to correct at the seam (R13).
 */
export function applyDrift(events: NoteEvent[], depth: number, passSec: number): NoteEvent[] {
  if (depth === 0 || passSec <= 0) return events.map((event) => ({ ...event }))

  const amplitude = (depth * passSec) / (2 * Math.PI)

  return events.map((event) => {
    const phase = (event.timeSec % passSec) / passSec
    return { ...event, timeSec: event.timeSec + amplitude * Math.sin(2 * Math.PI * phase) }
  })
}

/**
 * Put the loop back to exactly `loopSec`.
 *
 * `renderVoices` derives its buffer length from `max(timeSec + durationSec)`, so
 * a groove is only as long as it should be for as long as that maximum lands
 * exactly on the end of its last bar. Swing and humanization both move it, so
 * this pins it back: onsets are kept inside the loop, endings are trimmed to
 * it, and whichever event ends last is stretched to meet it.
 */
export function fitToLoop(events: NoteEvent[], loopSec: number): NoteEvent[] {
  if (events.length === 0) return []

  const fitted = events.map((event) => {
    const timeSec = clamp(event.timeSec, 0, loopSec - MIN_DURATION_SEC)
    const durationSec = Math.max(MIN_DURATION_SEC, Math.min(event.durationSec, loopSec - timeSec))
    return { ...event, timeSec, durationSec }
  })

  let last = fitted[0]
  for (const event of fitted) {
    if (event.timeSec + event.durationSec > last.timeSec + last.durationSec) last = event
  }
  last.durationSec = loopSec - last.timeSec

  return fitted.sort((a, b) => a.timeSec - b.timeSec)
}

/**
 * A bipolar deviation in −1..1, concentrated near zero: three uniform draws
 * summed and centred.
 *
 * Not a true normal, and deliberately so — what R4 asks for is that a large
 * deviation be rarer than a small one, which three calls to the generator buy
 * with no dependency. A single uniform draw makes the extremes exactly as
 * likely as the centre, which is what reads as sloppiness rather than as feel.
 */
export function gaussianUnit(rng: () => number): number {
  return (rng() + rng() + rng()) / 1.5 - 1
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value))
}
