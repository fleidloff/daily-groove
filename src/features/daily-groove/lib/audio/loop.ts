/**
 * The arithmetic that turns a groove's metadata into a loop window inside a
 * decoded buffer, and elapsed seconds into a position through that loop.
 *
 * No Web Audio anywhere near it: these are plain functions of numbers, so the
 * timing rules can be tested without a context, a buffer or a clock.
 */

export type LoopWindow = {
  /** Seconds into the decoded buffer where the music begins. */
  loopStart: number
  /** `loopStart + loopSeconds`, clamped to the buffer's length. */
  loopEnd: number
}

/** A finite, non-negative number, or `fallback`. */
function nonNegative(value: number, fallback: number): number {
  return Number.isFinite(value) && value >= 0 ? value : fallback
}

/**
 * The loop window for a groove inside a decoded buffer.
 *
 * `headDelaySeconds` is the groove's *own* measured value — the encoder delay
 * `ffprobe` read off that file at mint time, written into the manifest beside
 * `bpm` and `bars`. It is not inferred here from the buffer's length, and it is
 * not shared with any other groove: a file minted under a different encoder
 * configuration carries a different number and this function never notices.
 *
 * `bufferSeconds` only clamps. It cannot lengthen a window, and it cannot move
 * its start: a head delay that does not fit inside the buffer describes no
 * music, so the window falls back to the top of the buffer rather than to a
 * point past the last sample.
 */
export function deriveLoopWindow(
  headDelaySeconds: number,
  loopSeconds: number,
  bufferSeconds: number,
): LoopWindow {
  const buffer = nonNegative(bufferSeconds, 0)
  const head = nonNegative(headDelaySeconds, 0)
  const length = nonNegative(loopSeconds, 0)

  const loopStart = head < buffer ? head : 0
  const loopEnd = Math.min(loopStart + length, buffer)

  return { loopStart, loopEnd: Math.max(loopEnd, loopStart) }
}

/**
 * Elapsed seconds mapped onto 0..1 of the loop.
 *
 * It wraps rather than clamps: the fiftieth repeat reads the same as the first,
 * because the position is derived from the clock on every read instead of being
 * counted forward. A negative elapsed — the latency correction running ahead of
 * the first sample to reach the listener — reads 0, as does a loop length that
 * cannot describe a length.
 */
export function loopPosition(elapsed: number, loopSeconds: number): number {
  if (!Number.isFinite(loopSeconds) || loopSeconds <= 0) return 0
  if (!Number.isFinite(elapsed) || elapsed <= 0) return 0
  return (elapsed % loopSeconds) / loopSeconds
}
