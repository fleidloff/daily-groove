/**
 * The feel stage: what turns a grid into a performance.
 *
 * Three pure functions, applied in order by `buildEvents`:
 *
 *   applySwing  — pushes the off-beat subdivisions late (R4)
 *   humanize    — nudges every onset and velocity, within bounds the template
 *                 declares, from the groove's own seeded generator (R5, R7)
 *   fitToLoop   — puts the loop back to exactly four bars afterwards
 *
 * Nothing here reads the clock or calls Math.random: every deviation comes from
 * the `rng` the caller passes in, which is what keeps "the same spec renders the
 * same audio" true after this epic (AC4).
 */

import type { FeelTemplate, NoteEvent } from './types.ts'

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
 * Nudge every event's timing and velocity by a bipolar deviation drawn from
 * `rng`, bounded by what the template declares.
 *
 * The timing bound is additionally clamped to just under half a subdivision, so
 * however loose a template asks to be, a note can never be nudged into its
 * neighbour's slot (R7). That clamp needs the tempo; without it only the
 * template's own millisecond bound applies.
 */
export function humanize(
  events: NoteEvent[],
  template: FeelTemplate,
  rng: () => number,
  bpm?: number,
): NoteEvent[] {
  const { timingMs, velocity } = template.humanize
  if (timingMs === 0 && velocity === 0) return events.map((event) => ({ ...event }))

  const subdivisionLimit =
    bpm === undefined
      ? Number.POSITIVE_INFINITY
      : // Strictly inside half a step, so the nearest-subdivision reading never ties.
        stepSecFor(bpm, template.subdivision) * 0.49
  const timingBound = Math.min(timingMs / 1000, subdivisionLimit)

  return events.map((event) => ({
    ...event,
    timeSec: event.timeSec + bipolar(rng) * timingBound,
    velocity: clamp(event.velocity + bipolar(rng) * velocity, MIN_VELOCITY, 1),
  }))
}

/**
 * Put the loop back to exactly `loopSec`.
 *
 * `renderVoices` derives its buffer length from `max(timeSec + durationSec)`, so
 * a groove is only four bars long for as long as that maximum lands exactly on
 * the end of bar four. Swing and humanization both move it, so this pins it
 * back: onsets are kept inside the loop, endings are trimmed to it, and
 * whichever event ends last is stretched to meet it.
 */
export function fitToLoop(events: NoteEvent[], loopSec: number): NoteEvent[] {
  if (events.length === 0) return []

  const fitted = events.map((event) => {
    const timeSec = clamp(event.timeSec, 0, loopSec - MIN_DURATION_SEC)
    const durationSec = Math.max(
      MIN_DURATION_SEC,
      Math.min(event.durationSec, loopSec - timeSec),
    )
    return { ...event, timeSec, durationSec }
  })

  let last = fitted[0]
  for (const event of fitted) {
    if (event.timeSec + event.durationSec > last.timeSec + last.durationSec) last = event
  }
  last.durationSec = loopSec - last.timeSec

  return fitted.sort((a, b) => a.timeSec - b.timeSec)
}

function bipolar(rng: () => number): number {
  return rng() * 2 - 1
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value))
}
