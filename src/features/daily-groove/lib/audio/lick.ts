import type { PitchSample } from '../../data/notes.generated'
import type { ScheduledNote } from '../theory/phrase'
import { sharedAudioContext } from './context'
import { REFERENCE_FADE_SECONDS, REFERENCE_LEVEL } from './level'

/**
 * One voice for the mode licks: the short phrase a mode chip sounds.
 *
 * It is the second voice on the shared graph, beside the single reference note
 * a root chip plays, and it is the same instrument — the band's own keyboard,
 * sequenced from the rendered pitches rather than synthesised (R7).
 *
 * **A phrase is a list of nodes, one per note, each with its own envelope.**
 * The note files ring for about two seconds; eight of them at eighth-note
 * spacing straight into the destination would be a cluster rather than a line,
 * so every note gets a `GainNode` opened at the declared level and ramped to
 * zero at the end of its own written length. The level and the ramp are one
 * number each, declared in `./level` and shared with the root row — they arrive
 * here as arguments, and the import is the fallback for a caller that hands in
 * something a gain node cannot use, never a second declaration.
 *
 * **The origin is asked for once, after the buffers are in hand.** A phrase may
 * need a fetch and a decode before it can sound, and a beat time computed
 * before that wait is a beat time in the past by the moment anything is
 * scheduled. So the voice holds the clock itself, and reads it immediately
 * before the first `start`: the next beat while the groove runs (R11), and the
 * context's own clock when it does not (R12). Reading is all it can do — the
 * clock's whole surface here is one question, which is what `PhraseClock`
 * narrowing it to a single member records (R9, R10, R14).
 *
 * **One reference sound at a time, across both rows.** The phrase takes the
 * shared output from Epic 3's owner, handing in the callback that silences
 * itself, so a mode tap cuts a ringing root and a root tap cuts a sounding lick
 * without either row naming the other (R8, R8a). Every node's creation is
 * guarded on the claim still being held, so a claim taken away part-way through
 * a phrase stops the rest of it being scheduled at all rather than needing to
 * be unpicked afterwards.
 *
 * Everything here is best effort. A lick is an aid the player asked for by
 * tapping a chip that has already selected, so a phrase that cannot sound is
 * silence — no banner, no retry, no console-visible break (R19, R20, R21).
 */

/**
 * One voice's hold on the shared reference output.
 *
 * Declared structurally rather than imported: this module needs the two members
 * it calls and nothing else, and Epic 3's `OutputClaim` in `./output` is a
 * supertype of it. Never a second implementation — there is exactly one owner.
 */
export type OutputClaim = { isHeld(): boolean; release(): void }

/** The shared owner, narrowed to the one call this voice makes. */
export type ReferenceOutput = { claim(cancel: () => void): OutputClaim }

/**
 * Where a phrase begins. Epic 3's `GrooveClock` is a supertype: the extra
 * members exist, and this voice deliberately cannot see them.
 */
export type PhraseClock = { nextBeat(now: number): number | null }

export type LickVoice = {
  /**
   * Best effort. Resolves when the phrase is scheduled, or silently when it
   * cannot be. The start time is the clock's, read after the buffers land: the
   * next beat while the groove runs, `ctx.currentTime` when it does not.
   */
  play(notes: ScheduledNote[]): Promise<void>
  /** Fetch and decode every pitch without sounding anything. Best effort. */
  warm(): Promise<void>
  dispose(): void
}

/** One note on the graph, and everything needed to let it go again. */
type Live = {
  ctx: AudioContext
  node: AudioBufferSourceNode
  gain: GainNode
  /** The graph time it was told to start at. Whether it sounded reads this. */
  startsAt: number
  cut: boolean
  torn: boolean
}

export function createLickVoice(deps: {
  pitches: PitchSample[]
  output: ReferenceOutput
  /** Epic 3's `REFERENCE_LEVEL`, the peak gain of every note. */
  level: number
  /** Epic 3's `REFERENCE_FADE_SECONDS`, the ramp on every note's tail and on a cancel. */
  fadeSeconds: number
  /** Epic 3's `GrooveClock`. Absent means every phrase is immediate. */
  clock?: PhraseClock
}): LickVoice {
  const { pitches, output, clock } = deps

  /*
   * The declared numbers, with the shared declaration as the floor. A caller
   * that hands in something a gain node cannot use — NaN from an unparsed
   * setting, a negative fade — would otherwise make the whole phrase inaudible,
   * and one declared level is exactly what stops that being a second opinion.
   */
  const level = Number.isFinite(deps.level) ? deps.level : REFERENCE_LEVEL
  const fadeSeconds =
    Number.isFinite(deps.fadeSeconds) && deps.fadeSeconds >= 0
      ? deps.fadeSeconds
      : REFERENCE_FADE_SECONDS

  /** Keyed by midi: a phrase asks for pitches, not for roots. */
  const files = new Map<number, string>(
    pitches.map((pitch) => [pitch.midi, pitch.audioSrc]),
  )
  /** Decoded once per pitch, reused by every later phrase that needs it (R32). */
  const buffers = new Map<number, AudioBuffer>()
  /** One in-flight decode per pitch, shared by every concurrent caller. */
  const inFlight = new Map<number, Promise<AudioBuffer>>()
  /** How to silence the phrase on the graph, if there is one. */
  let silenceCurrent: (() => void) | null = null

  async function fetchAndDecode(
    src: string,
    ctx: AudioContext,
  ): Promise<AudioBuffer> {
    const response = await fetch(src)
    if (!response.ok) {
      throw new Error(`Could not fetch ${src}: ${response.status}`)
    }
    return await ctx.decodeAudioData(await response.arrayBuffer())
  }

  /**
   * Resolves once this pitch's buffer is in hand. Rejects on every failure —
   * `play` and `warm` are the two places that swallow, so this one stays a
   * plain fetch-and-decode.
   */
  async function ensureBuffer(midi: number): Promise<AudioBuffer> {
    const cached = buffers.get(midi)
    if (cached) return cached

    const src = files.get(midi)
    if (!src) throw new Error(`No rendered pitch for midi ${midi}`)

    let started = inFlight.get(midi)
    if (!started) {
      started = fetchAndDecode(src, sharedAudioContext())
      inFlight.set(midi, started)
    }

    try {
      const buffer = await started
      buffers.set(midi, buffer)
      return buffer
    } finally {
      // Cleared either way: on success the buffer is cached, and on failure a
      // later tap must start a fresh fetch rather than re-await the rejection.
      inFlight.delete(midi)
    }
  }

  /** The graph time to schedule against, or `null` for "sound now" (R12). */
  function beatAfter(now: number): number | null {
    if (!clock) return null
    try {
      return clock.nextBeat(now)
    } catch {
      // A broken grid must not cost the player the phrase: off the beat beats
      // absent.
      return null
    }
  }

  /**
   * The nodes go. Deferred to the graph's own end-of-note report for a note
   * that is fading, because tearing the chain down when the fade is scheduled
   * would cut the fade it exists to allow.
   */
  function tearDown(entry: Live) {
    if (entry.torn) return
    entry.torn = true
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
  }

  return {
    async play(notes: ScheduledNote[]) {
      try {
        if (notes.length === 0) return

        /*
         * Every buffer, or none. A phrase missing its third note is not the
         * phrase, and a partial one would claim the output — cutting whatever
         * is ringing — to play something wrong.
         */
        const decoded = await Promise.all(
          notes.map((note) => ensureBuffer(note.midi)),
        )

        const ctx = sharedAudioContext()
        if (ctx.state === 'suspended') await ctx.resume()

        // Read here and nowhere earlier: this is the first moment the phrase is
        // certain to sound, so it is the only honest moment to ask where it
        // begins (R11, R12).
        const now = ctx.currentTime
        const beat = beatAfter(now)
        // Only ever forward: a beat at or behind the tap means sound it now.
        const origin = beat !== null && beat > now ? beat : now

        /** This phrase's nodes. A later phrase gets its own list. */
        const entries: Live[] = []
        let outstanding = 0

        function ended(entry: Live) {
          tearDown(entry)
          outstanding -= 1
          if (outstanding > 0) return
          try {
            // Idempotent, and a no-op once superseded — which is why it needs
            // no held check of its own.
            held.release()
          } catch {
            // The owner has already moved on.
          }
        }

        /** Let one note go. The one path for every cancellation. */
        function cut(entry: Live) {
          if (entry.cut) return
          entry.cut = true

          const at = entry.ctx.currentTime
          const sounding = entry.startsAt <= at

          if (!sounding) {
            /*
             * A note still waiting for its beat has nothing to fade, and a stop
             * time before its start time means it never sounds at all — which
             * is what R8 asks for. The graph may never report an end for a node
             * it never played, so the chain goes now.
             */
            try {
              entry.node.stop(at)
            } catch {
              // Already stopped, or never started.
            }
            ended(entry)
            return
          }

          const end = at + fadeSeconds
          try {
            entry.gain.gain.cancelScheduledValues(at)
          } catch {
            // No automation to cancel.
          }
          try {
            entry.gain.gain.setValueAtTime(entry.gain.gain.value, at)
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
            // Already stopped.
          }
        }

        function cancelAll() {
          for (const entry of entries.splice(0, entries.length)) cut(entry)
        }

        /*
         * Taken over once every buffer is in hand and before the first `start`,
         * exactly where the root row's voice takes it: a fetch that failed must
         * not cut off what is already ringing. Claiming runs the previous
         * holder's cancel, whichever row it belonged to (R8, R8a).
         */
        const held = output.claim(cancelAll)
        silenceCurrent = cancelAll

        notes.forEach((note, index) => {
          // Guarded per node rather than once: a claim taken away part-way
          // through stops the rest of the phrase being scheduled at all.
          if (!held.isHeld()) return

          const startsAt = origin + note.offsetSeconds
          const end = startsAt + note.durationSeconds + fadeSeconds

          const gain = ctx.createGain()
          // Anchored at the note's own start, so the ramp below has a value to
          // fall from and the note before it is not touched.
          gain.gain.setValueAtTime(level, startsAt)
          gain.gain.linearRampToValueAtTime(0, end)
          gain.connect(ctx.destination)

          const node = ctx.createBufferSource()
          node.buffer = decoded[index]
          node.connect(gain)

          const entry: Live = {
            ctx,
            node,
            gain,
            startsAt,
            cut: false,
            torn: false,
          }
          node.onended = () => {
            ended(entry)
          }

          node.start(startsAt)
          // The written length plus the ramp. Without it the file's full two
          // seconds would ring under the notes that follow.
          node.stop(end)

          entries.push(entry)
          outstanding += 1
        })
      } catch {
        // Silence is the failure mode (R20, R21, AC14).
      }
    },

    async warm() {
      // `allSettled`, so one missing file does not cost the other twenty-three
      // their head start. Warming is an optimisation, never a precondition for
      // a phrase to sound (R33).
      await Promise.allSettled(
        pitches.map(async (pitch) => {
          await ensureBuffer(pitch.midi)
        }),
      )
    },

    dispose() {
      const silence = silenceCurrent
      silenceCurrent = null
      if (silence) {
        try {
          silence()
        } catch {
          // A phrase built over a context that is gone has nothing to silence.
        }
      }
      buffers.clear()
      inFlight.clear()
      // The context stays open: it belongs to the page, and the groove may
      // still be playing through it.
    },
  }
}
