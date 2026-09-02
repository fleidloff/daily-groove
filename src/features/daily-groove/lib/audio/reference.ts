import type { ReferenceNote } from '../../data/notes.generated'
import type { Root } from '../../types'
import type { GrooveClock } from './beat'
import { sharedAudioContext } from './context'
import { REFERENCE_FADE_SECONDS, REFERENCE_LEVEL } from './level'
import { referenceOutput, type OutputClaim } from './output'

export type ReferenceVoice = {
  play(root: Root): Promise<void>
  warm(): Promise<void>
  dispose(): void
}

type Sounding = {
  ctx: AudioContext
  node: AudioBufferSourceNode
  gain: GainNode
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
  const buffers = new Map<Root, AudioBuffer>()
  const pending = new Map<Root, Promise<AudioBuffer>>()
  let current: Sounding | null = null

  async function decode(src: string, ctx: AudioContext): Promise<AudioBuffer> {
    const response = await fetch(src)
    if (!response.ok) {
      throw new Error(`Could not fetch ${src}: ${response.status}`)
    }
    return await ctx.decodeAudioData(await response.arrayBuffer())
  }

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
      pending.delete(root)
    }
  }

  function beatAfter(now: number): number | null {
    if (!clock) return null
    try {
      return clock.nextBeat(now)
    } catch {
      return null
    }
  }

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
        const startsAt = beat !== null && beat > now ? beat : now

        const gain = ctx.createGain()
        gain.gain.value = REFERENCE_LEVEL
        gain.connect(ctx.destination)

        const next = ctx.createBufferSource()
        next.buffer = buffer
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
          try {
            entry.unwatch = clock.subscribe(() => {
              try {
                if (!clock.isRunning() && entry.startsAt > ctx.currentTime) {
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
    },
  }
}
