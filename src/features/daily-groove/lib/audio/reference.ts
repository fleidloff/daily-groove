import type { ReferenceNote } from '../../data/notes.generated'
import type { Root } from '../../types'
import { sharedAudioContext } from './context'

/**
 * One voice for the reference notes: the single pitch a root chip sounds.
 *
 * It is a second, independent voice on the shared graph — it never reads the
 * transport and the transport never reads it, so a tap cannot stop, restart or
 * move the groove, and stopping the groove cannot cut a ringing note (R6, R13,
 * AC5, AC11). The only thing the two share is the `AudioContext`.
 *
 * Everything here is best effort. A reference pitch is an aid, not the thing
 * the player pressed for, so a note that cannot sound produces silence and no
 * banner, no retry and no console-visible break (R10, R11, AC8, AC9). That is
 * why `play` resolves on every path and why the build guard, not the runtime,
 * is where a missing file surfaces.
 */
export type ReferenceVoice = {
  /** Best effort. Resolves when the note has started, or silently when it cannot. */
  play(root: Root): Promise<void>
  /** Fetch and decode every note without sounding anything. Best effort. */
  warm(): Promise<void>
  dispose(): void
}

export function createReferenceVoice(notes: ReferenceNote[]): ReferenceVoice {
  const sources = new Map<Root, string>(
    notes.map((note) => [note.root, note.audioSrc]),
  )
  /** Decoded once per root, reused for every later tap of it (R17, AC14). */
  const buffers = new Map<Root, AudioBuffer>()
  /** One in-flight decode per root, shared by every concurrent caller. */
  const pending = new Map<Root, Promise<AudioBuffer>>()
  /** The sounding node. At most one, which is what R5 means. */
  let node: AudioBufferSourceNode | null = null

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

  /** Silences whatever is ringing. A node that already ended throws; that is fine. */
  function releaseNode() {
    const current = node
    node = null
    if (!current) return
    try {
      current.stop()
    } catch {
      // Already stopped, or never started. Nothing to undo.
    }
    try {
      current.disconnect()
    } catch {
      // Already disconnected.
    }
  }

  return {
    async play(root: Root) {
      try {
        const buffer = await ensureBuffer(root)
        const ctx = sharedAudioContext()
        if (ctx.state === 'suspended') await ctx.resume()

        // Taken over only once the note is certain to sound: a fetch that
        // failed must not cut off the note already ringing.
        releaseNode()

        const next = ctx.createBufferSource()
        next.buffer = buffer
        // Not a loop and not scheduled: it rings for the length of the file and
        // decays to silence on its own (R3, R4).
        next.loop = false
        next.connect(ctx.destination)
        next.onended = () => {
          if (node === next) node = null
        }
        next.start()
        node = next
      } catch {
        // Silence is the failure mode (R10, AC8, AC9).
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
      releaseNode()
      buffers.clear()
      pending.clear()
      // The context stays open: it belongs to the page, and the groove may
      // still be playing through it (R16).
    },
  }
}
