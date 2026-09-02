import type { FeelTemplate, NoteEvent, VoiceName } from './types.ts'

const BEATS_PER_BAR = 4

const MIN_VELOCITY = 0.02

const MIN_DURATION_SEC = 0.005

export function stepSecFor(bpm: number, subdivision: number): number {
  return ((60 / bpm) * BEATS_PER_BAR) / subdivision
}

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

const WALK_GROUPS: Partial<Record<VoiceName, string>> = {
  kick: 'low',
  bass: 'low',
}

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
      : stepSecFor(bpm, template.subdivision) * 0.49
  const timingBound = Math.min(timingMs / 1000, subdivisionLimit)

  const walks = new Map<string, number>()

  return events.map((event) => {
    const group = WALK_GROUPS[event.voice] ?? event.voice
    const previous = walks.get(group) ?? 0
    const walk = clamp(previous + gaussianUnit(rng) * timingBound, -timingBound, timingBound)
    walks.set(group, walk)

    const leanSec = (lean[event.voice] ?? 0) / 1000
    const displacement = clamp(leanSec + walk, -subdivisionLimit, subdivisionLimit)

    return {
      ...event,
      timeSec: event.timeSec + displacement,
      velocity: clamp(event.velocity + gaussianUnit(rng) * velocity, MIN_VELOCITY, 1),
    }
  })
}

export function applyDrift(events: NoteEvent[], depth: number, passSec: number): NoteEvent[] {
  if (depth === 0 || passSec <= 0) return events.map((event) => ({ ...event }))

  const amplitude = (depth * passSec) / (2 * Math.PI)

  return events.map((event) => {
    const phase = (event.timeSec % passSec) / passSec
    return { ...event, timeSec: event.timeSec + amplitude * Math.sin(2 * Math.PI * phase) }
  })
}

export function fitToLoop(events: NoteEvent[], loopSec: number): NoteEvent[] {
  if (events.length === 0) return []

  return events
    .map((event) => {
      const timeSec = clamp(event.timeSec, 0, loopSec - MIN_DURATION_SEC)
      const durationSec = Math.max(MIN_DURATION_SEC, Math.min(event.durationSec, loopSec - timeSec))
      return { ...event, timeSec, durationSec }
    })
    .sort((a, b) => a.timeSec - b.timeSec)
}

export function gaussianUnit(rng: () => number): number {
  return (rng() + rng() + rng()) / 1.5 - 1
}

function clamp(value: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, value))
}
