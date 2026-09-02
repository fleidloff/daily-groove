/**
 * The quarter-note grid a tapped chip is scheduled against.
 *
 * Two halves. The first is plain arithmetic over numbers — seconds per beat,
 * seconds until the next one — in the same spirit as `loop.ts`: no Web Audio,
 * no context, no buffer, no clock, so the timing rules are testable as
 * functions. The second closes that arithmetic over a tempo and a source of
 * "when did the groove start" and answers the one question a voice has: what
 * graph time do I schedule against?
 *
 * The grid is the quarter note and nothing else (R8a) — not the bar, not a
 * subdivision — and it never wraps: every groove's loop is a whole number of
 * beats, so a grid counted from the start time cannot drift across a loop
 * boundary.
 *
 * Reading the groove's clock is one-way (R9). This module has no view of the
 * transport beyond two read-only methods, which is why it can never stop,
 * restart or reschedule it.
 */

/**
 * A tap this close before a beat counts as that beat and sounds at once (R6a).
 *
 * Chosen by ear rather than computed: wide enough that a player tapping
 * deliberately in time is never held back a whole beat, narrow enough that a
 * note never arrives audibly early. No test asserts this literal.
 */
export const BEAT_TOLERANCE_SECONDS = 0.06

/** Seconds per quarter-note beat. 0 for a tempo that cannot describe one. */
export function beatSeconds(bpm: number): number {
  return Number.isFinite(bpm) && bpm > 0 ? 60 / bpm : 0
}

/**
 * Seconds to wait, from a position in the groove, until the next quarter-note
 * beat. 0 means now: the position is on a beat, is inside the tolerance before
 * one, or there is no usable grid. Never negative — the grid only schedules
 * forward (R6b), so a tap that lands after a beat waits for the following one
 * rather than being pulled back to the one it missed.
 */
export function secondsToNextBeat(
  grooveSeconds: number,
  beatLength: number,
  tolerance: number = BEAT_TOLERANCE_SECONDS,
): number {
  if (!Number.isFinite(beatLength) || beatLength <= 0) return 0
  if (!Number.isFinite(grooveSeconds)) return 0

  const position = grooveSeconds > 0 ? grooveSeconds : 0
  const since = position % beatLength
  if (since === 0) return 0

  const until = beatLength - since
  return until <= Math.max(tolerance, 0) ? 0 : until
}

/** What a clock needs from the transport. Read-only, both members. */
export type BeatSource = {
  /** Graph time at which the groove's beat 0 was emitted; null when stopped. */
  getStartTime(): number | null
  subscribe(listener: () => void): () => void
}

export type GrooveClock = {
  /**
   * The graph time to schedule against for a tap at graph time `now`, or
   * `null` when the groove is not running — in which case the caller sounds
   * immediately (R7).
   */
  nextBeat(now: number): number | null
  /** Whether the groove is running. */
  isRunning(): boolean
  /** Notified when the groove starts, stops or ticks. Reading only (R9). */
  subscribe(listener: () => void): () => void
}

/**
 * A grid at `bpm` over a source that knows when the groove started.
 *
 * `source.getStartTime()` is the *emission* clock — the graph time the groove's
 * first sample was handed over — deliberately not the latency-corrected
 * elapsed time the progress bar reads. A sample handed to the graph at time `T`
 * reaches the ear at `T + latency`, so a note and a beat placed on the same
 * emission timeline coincide at the ear and the latency cancels. Scheduled
 * against the corrected figure they would not.
 *
 * A tempo that cannot describe a beat degrades to immediate rather than to
 * broken: a reference note off the beat beats no reference note.
 */
export function createGrooveClock(source: BeatSource, bpm: number): GrooveClock {
  const beat = beatSeconds(bpm)

  return {
    nextBeat(now: number): number | null {
      const startedAt = source.getStartTime()
      if (startedAt === null || !Number.isFinite(now)) return null
      return now + secondsToNextBeat(now - startedAt, beat)
    },
    isRunning(): boolean {
      return source.getStartTime() !== null
    },
    subscribe(listener: () => void): () => void {
      return source.subscribe(listener)
    },
  }
}
