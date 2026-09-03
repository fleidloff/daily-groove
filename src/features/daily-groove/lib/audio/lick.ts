import type { PitchSample } from '../../data/notes.generated'
import type { ScheduledNote } from '@/lib/theory/phrase'
import { sharedAudioContext } from './context'
import { REFERENCE_FADE_SECONDS, REFERENCE_LEVEL } from './level'

export type OutputClaim = { isHeld(): boolean; release(): void }

export type ReferenceOutput = { claim(cancel: () => void): OutputClaim }

export type PhraseClock = { nextBeat(now: number): number | null }

export type LickVoice = {
  play(notes: ScheduledNote[]): Promise<void>
  warm(): Promise<void>
  dispose(): void
}

type Live = {
  ctx: AudioContext
  node: AudioBufferSourceNode
  gain: GainNode
  startsAt: number
  cut: boolean
  torn: boolean
}

export function createLickVoice(deps: {
  pitches: PitchSample[]
  output: ReferenceOutput
  level: number
  fadeSeconds: number
  clock?: PhraseClock
}): LickVoice {
  const { pitches, output, clock } = deps

  const level = Number.isFinite(deps.level) ? deps.level : REFERENCE_LEVEL
  const fadeSeconds =
    Number.isFinite(deps.fadeSeconds) && deps.fadeSeconds >= 0
      ? deps.fadeSeconds
      : REFERENCE_FADE_SECONDS

  const files = new Map<number, string>(
    pitches.map((pitch) => [pitch.midi, pitch.audioSrc]),
  )
  const buffers = new Map<number, AudioBuffer>()
  const inFlight = new Map<number, Promise<AudioBuffer>>()
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
      inFlight.delete(midi)
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

        const decoded = await Promise.all(
          notes.map((note) => ensureBuffer(note.midi)),
        )

        const ctx = sharedAudioContext()
        if (ctx.state === 'suspended') await ctx.resume()

        const now = ctx.currentTime
        const beat = beatAfter(now)
        const origin = beat !== null && beat > now ? beat : now

        const entries: Live[] = []
        let outstanding = 0

        function ended(entry: Live) {
          tearDown(entry)
          outstanding -= 1
          if (outstanding > 0) return
          try {
            held.release()
          } catch {
            // The owner has already moved on.
          }
        }

        function cut(entry: Live) {
          if (entry.cut) return
          entry.cut = true

          const at = entry.ctx.currentTime
          const sounding = entry.startsAt <= at

          if (!sounding) {
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

        const held = output.claim(cancelAll)
        silenceCurrent = cancelAll

        notes.forEach((note, index) => {
          if (!held.isHeld()) return

          const startsAt = origin + note.offsetSeconds
          const end = startsAt + note.durationSeconds + fadeSeconds

          const gain = ctx.createGain()
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
          node.stop(end)

          entries.push(entry)
          outstanding += 1
        })
      } catch {
        // Silence is the failure mode (R20, R21, AC14).
      }
    },

    async warm() {
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
    },
  }
}
