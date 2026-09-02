import type { ReferenceNote } from '../../data/notes.generated'
import type { Root } from '../../types'
import type { GrooveClock } from './beat'
import { sharedAudioContext } from './context'
import { REFERENCE_FADE_SECONDS, REFERENCE_LEVEL } from './level'
import { referenceOutput, type OutputClaim } from './output'

/**
 * One voice for the reference notes: the single pitch a root chip sounds.
 *
 * It is a second, independent voice on the shared graph, and what it knows of
 * the groove is exactly three read-only methods on a `GrooveClock` (R9, AC7).
 * It reads when the next beat falls and whether the groove is running; it can
 * neither stop, restart, move nor reschedule anything, because it has no view
 * of the thing that does. That narrowing is deliberate and one-directional.
 *
 * Every note is routed through its own `GainNode` at `REFERENCE_LEVEL` rather
 * than straight to the destination (R1, AC1) — one number, declared in
 * `./level` and shared with the mode-lick voice, never chosen here (R2). A note
 * that is taken over is ramped down over `REFERENCE_FADE_SECONDS` instead of
 * being cut, so a finger run down the chip row does not click (R5, AC3), and
 * the same ramp silences a note still waiting for its beat: a gain at zero
 * before the start time and a stop time before it both mean silence (R10).
 *
 * Which voice is sounding is not this module's to decide either. It takes the
 * shared output from `./output` and hands in its own cancel callback, so a lick
 * silences a root and a root silences a lick without either row naming the
 * other (R10a, R10b, AC8c).
 *
 * Everything here is best effort. A reference pitch is an aid, not the thing
 * the player pressed for, so a note that cannot sound produces silence and no
 * banner, no retry and no console-visible break (R14, AC12). A clock that
 * throws degrades to an immediate note rather than to no note: off the beat is
 * better than absent.
 */
export type ReferenceVoice = {
  /** Best effort. Resolves when the note has started, or silently when it cannot. */
  play(root: Root): Promise<void>
  /** Fetch and decode every note without sounding anything. Best effort. */
  warm(): Promise<void>
  dispose(): void
}

/** One note on the graph, and everything needed to let it go again. */
type Sounding = {
  ctx: AudioContext
  node: AudioBufferSourceNode
  gain: GainNode
  /** The graph time it was told to start at. The R11/R12 distinction reads it. */
  startsAt: number
  released: boolean
  claim: OutputClaim | null
  unwatch: (() => void) | null
}

export function createReferenceVoice(
  notes: ReferenceNote[],
  clock?: GrooveClock,
): ReferenceVoice {
  const sources = new Map<Root, string>(
    notes.map((note) => [note.root, note.audioSrc]),
  )
  /** Decoded once per root, reused for every later tap of it (R17, AC14). */
  const buffers = new Map<Root, AudioBuffer>()
  /** One in-flight decode per root, shared by every concurrent caller. */
  const pending = new Map<Root, Promise<AudioBuffer>>()
  /** The note on the graph. At most one, which is what R10 means. */
  let current: Sounding | null = null

  async function decode(src: string, ctx: AudioContext): Promise<AudioBuffer> {
    const response = await fetch(src)
    if (!response.ok) {
      throw new Error(`Could not fetch ${src}: ${response.status}`)
    }
    return await ctx.decodeAudioData(await response.arrayBuffer())
  }

  /**
   * Resolves once this root's buffer is in hand. Rejects on every failure —
   * `play` and `warm` are the two places that swallow, so this one can stay a
   * plain fetch-and-decode.
   */
  async function ensureBuffer(root: Root): Promise<AudioBuffer> {
    const cached = buffers.get(root)
    if (cached) return cached

    const src = sources.get(root)
    if (!src) throw new Error(`No reference note for ${root}`)

    let inFlight = pending.get(root)
    if (!inFlight) {
      inFlight = decode(src, sharedAudioContext())
      pending.set(root, inFlight)
    }

    try {
      const buffer = await inFlight
      buffers.set(root, buffer)
      return buffer
    } finally {
      // Cleared either way: on success the buffer is cached, and on failure a
      // later tap must start a fresh fetch rather than re-await the rejection.
      pending.delete(root)
    }
  }

  /** The graph time to schedule against, or `null` for "sound now" (R7, R14). */
  function beatAfter(now: number): number | null {
    if (!clock) return null
    try {
      return clock.nextBeat(now)
    } catch {
      // A broken grid must not cost the player the note.
      return null
    }
  }

  /**
   * Lets a note go — the one path for every cancellation.
   *
   * Taken over by another root, taken over by the other chip row, or dropped
   * because the beat it was waiting for will never arrive: all three are the
   * same three lines, because a gain ramped to zero and a stop time that
   * precedes the start time both produce silence. Only the *groove stopped*
   * case needs to know whether the note had sounded, and that test lives in the
   * watcher rather than here (R11, R12).
   *
   * Each call is guarded on its own: a node the graph has already finished with
   * throws, and one failure must not skip the rest of the teardown.
   */
  function release(entry: Sounding) {
    if (entry.released) return
    entry.released = true

    unwatch(entry)

    const now = entry.ctx.currentTime
    const end = now + REFERENCE_FADE_SECONDS

    try {
      entry.gain.gain.cancelScheduledValues(now)
    } catch {
      // No automation to cancel.
    }
    try {
      entry.gain.gain.setValueAtTime(entry.gain.gain.value, now)
    } catch {
      // Nothing to anchor the ramp to; the ramp below still runs.
    }
    try {
      entry.gain.gain.linearRampToValueAtTime(0, end)
    } catch {
      // Cannot fade. The stop below is still the silence.
    }
    try {
      entry.node.stop(end)
    } catch {
      // Already stopped, or never started. Nothing to undo.
    }

    handBack(entry)
  }

  /**
   * The end of the ramp, as the graph reports it. The disconnect waits for this
   * rather than happening at takeover time, because tearing the nodes down when
   * the fade is scheduled would cut the fade it exists to allow.
   */
  function finish(entry: Sounding) {
    unwatch(entry)
    try {
      entry.node.disconnect()
    } catch {
      // Already disconnected.
    }
    try {
      entry.gain.disconnect()
    } catch {
      // Already disconnected.
    }
    handBack(entry)
  }

  function unwatch(entry: Sounding) {
    const stop = entry.unwatch
    entry.unwatch = null
    if (!stop) return
    try {
      stop()
    } catch {
      // The clock is gone. Nothing to unsubscribe from.
    }
  }

  function handBack(entry: Sounding) {
    try {
      entry.claim?.release()
    } catch {
      // The owner has already moved on.
    }
    if (current === entry) current = null
  }

  return {
    async play(root: Root) {
      try {
        const buffer = await ensureBuffer(root)
        const ctx = sharedAudioContext()
        if (ctx.state === 'suspended') await ctx.resume()

        const now = ctx.currentTime
        const beat = beatAfter(now)
        // Only ever forward: a beat at or behind the tap means sound it now
        // (R6b), and no beat at all means the groove is not running (R7, AC5).
        const startsAt = beat !== null && beat > now ? beat : now

        const gain = ctx.createGain()
        gain.gain.value = REFERENCE_LEVEL
        gain.connect(ctx.destination)

        const next = ctx.createBufferSource()
        next.buffer = buffer
        // Not a loop: it rings for the length of the file and decays to silence
        // on its own (R3, R4).
        next.loop = false
        next.connect(gain)

        const entry: Sounding = {
          ctx,
          node: next,
          gain,
          startsAt,
          released: false,
          claim: null,
          unwatch: null,
        }
        next.onended = () => {
          finish(entry)
        }

        if (clock && startsAt > now) {
          // Only a note actually waiting for a beat watches the groove: one
          // that sounds immediately has nothing left to cancel. The handler is
          // a null check and a comparison, which is what makes it cheap enough
          // to run on the clock's every notification.
          try {
            entry.unwatch = clock.subscribe(() => {
              try {
                if (!clock.isRunning() && entry.startsAt > ctx.currentTime) {
                  // The beat it was queued for will never come (R12, AC10). A
                  // note already sounding falls outside this test and rings on
                  // to its own end (R11, AC9).
                  release(entry)
                }
              } catch {
                // A clock that throws mid-notification is not the note's problem.
              }
            })
          } catch {
            // No watch. The note still sounds; it just cannot be dropped early.
          }
        }

        // Taken over only once the note is certain to sound: a fetch that
        // failed must not cut off the note already ringing. Claiming runs the
        // previous holder's cancel, whichever row it belongs to.
        entry.claim = referenceOutput().claim(() => {
          release(entry)
        })

        next.start(startsAt)
        current = entry
      } catch {
        // Silence is the failure mode (R14, AC12).
      }
    },

    async warm() {
      // `allSettled`, so one missing file does not cost the other eleven their
      // head start. Warming is an optimisation, never a precondition (R19a).
      await Promise.allSettled(
        notes.map(async (note) => {
          await ensureBuffer(note.root)
        }),
      )
    },

    dispose() {
      if (current) release(current)
      buffers.clear()
      pending.clear()
      // The context stays open: it belongs to the page, and the groove may
      // still be playing through it (R16).
    },
  }
}
