import { sharedAudioContext } from './context'
import { deriveLoopWindow } from './loop'

/** The one groove this player sounds: what to fetch, and where its music is. */
export type PlayableSource = {
  src: string
  /** Musical loop length in seconds, from `loopSecondsOf(groove)`. */
  loopSeconds: number
  /**
   * Seconds of encoder delay at the head of this file, off the groove's own
   * manifest entry. Per file, never shared across the catalogue.
   */
  headDelaySeconds: number
}

export type AudioPlayer = {
  /** Fetch and decode. Idempotent and safe to call concurrently. */
  load(): Promise<void>
  /** Starts a looping source from the top. Loads first if needed. */
  play(): Promise<void>
  stop(): void
  /** True between the first press and the first sound. */
  isLoading(): boolean
  isPlaying(): boolean
  /** Latency-corrected seconds since the source started. 0 when stopped. */
  getElapsed(): number
  /**
   * Graph time at which the groove's first sample was emitted, or null when
   * stopped.
   *
   * Deliberately *not* latency-corrected, and that is the whole reason it
   * exists beside `getElapsed()`: a sample handed to the graph at time `T`
   * reaches the ear at `T + latency`, so anything scheduled against the groove
   * has to be placed on the same emission clock the groove was placed on, or
   * it lands exactly one output latency late — 10-40ms wired, 150-300ms over
   * Bluetooth. `getElapsed()` stays the heard timeline the progress bar draws.
   */
  getStartTime(): number | null
  subscribe(fn: () => void): () => void
  dispose(): void
}

/**
 * What the browser reports about the gap between the graph and the ear. Both
 * are optional at runtime whatever `lib.dom` says: Safari exposes only
 * `baseLatency`, and an older engine neither.
 */
type LatencyReporting = {
  outputLatency?: number
  baseLatency?: number
}

/**
 * Seconds between a sample leaving the graph and reaching the listener: 10–40ms
 * wired, 150–300ms over Bluetooth. Whatever the context reports, uncorrected
 * where it reports nothing — the page never calibrates it (R3, AC4a).
 */
function latencyOf(context: AudioContext): number {
  const reported = context as LatencyReporting
  const latency = reported.outputLatency ?? reported.baseLatency ?? 0
  return Number.isFinite(latency) && latency > 0 ? latency : 0
}

/**
 * Plays one groove through Web Audio: fetch the mp3, decode it once, and run it
 * through an `AudioBufferSourceNode` whose loop points bracket the *music*.
 *
 * Three things follow from not being an `HTMLAudioElement`:
 *
 * - The loop wraps at `loopEnd`, which is the end of the groove, not the end of
 *   the file. The mp3s carry encoder delay at the head and padding at the tail,
 *   so `element.loop` inserted ~25ms of silence into every repeat and the groove
 *   slid later the longer it ran (R1).
 * - Elapsed time comes from the graph's own clock minus the output latency, so
 *   it describes audio that has reached the listener rather than audio that has
 *   been handed to the device (R2, R3).
 * - Nothing is audible until the whole file has been decoded, which is why
 *   `isLoading()` exists: Web Audio has no progressive playback, so the press
 *   and the first sound are separated by a gap the control has to show (R7a).
 *
 * Position is *derived* on every read rather than counted, so a frozen
 * animation loop — a backgrounded tab — costs nothing: the next frame reads the
 * truth and the highlight snaps to it.
 *
 * The context itself belongs to `./context`, not to the player: the reference
 * note a root chip sounds shares it. Nothing constructs one until the first
 * `load()`, so none exists during render or a server prerender (R6, AC7).
 */
export function createAudioPlayer(source: PlayableSource): AudioPlayer {
  const listeners = new Set<() => void>()

  let context: AudioContext | null = null
  let buffer: AudioBuffer | null = null
  /** The single in-flight decode, shared by every concurrent caller (R10). */
  let pending: Promise<AudioBuffer> | null = null
  /** The sounding node. A buffer source is single-use, so this is per press. */
  let node: AudioBufferSourceNode | null = null
  let startedAt: number | null = null
  let loading = false
  let frame: number | null = null

  function notify() {
    // Copy first: a listener may unsubscribe while being notified.
    for (const listener of Array.from(listeners)) listener()
  }

  // React reads position through `useSyncExternalStore`, so something has to
  // say "look again" every frame while the clock is moving. The player owns
  // that loop because it owns the clock.
  function tick() {
    frame = requestAnimationFrame(tick)
    notify()
  }

  function startPolling() {
    if (typeof requestAnimationFrame !== 'function') return
    if (frame === null) frame = requestAnimationFrame(tick)
  }

  function stopPolling() {
    if (frame !== null) {
      cancelAnimationFrame(frame)
      frame = null
    }
  }

  async function decode(): Promise<AudioBuffer> {
    // `sharedAudioContext()` throws where the browser has no Web Audio, and it
    // is called from inside an async function, so the press *rejects* and lands
    // in the error state the retry affordance already handles (R7, AC8a).
    const ctx = sharedAudioContext()
    context = ctx

    const response = await fetch(source.src)
    if (!response.ok) {
      throw new Error(`Could not fetch ${source.src}: ${response.status}`)
    }
    return await ctx.decodeAudioData(await response.arrayBuffer())
  }

  /** Resolves once the buffer is in hand. Every failure clears the busy state. */
  async function ensureBuffer(): Promise<AudioBuffer> {
    if (buffer) return buffer

    if (!pending) {
      loading = true
      notify()
      pending = decode()
    }

    try {
      buffer = await pending
      return buffer
    } catch (error) {
      // A failed press is retryable: drop the in-flight promise so the next one
      // starts a fresh fetch rather than re-awaiting the rejection.
      pending = null
      throw error
    } finally {
      if (loading) {
        loading = false
        notify()
      }
    }
  }

  function releaseNode() {
    if (!node) return
    try {
      node.stop()
    } catch {
      // A node that never started, or already ended, throws. Nothing to undo.
    }
    node.disconnect()
    node = null
  }

  return {
    async load() {
      await ensureBuffer()
    },

    async play() {
      const decoded = await ensureBuffer()
      const ctx = context
      if (!ctx) throw new Error('Audio playback is unavailable in this browser')

      // Two presses that raced through the same decode must not produce two
      // voices: the first one to arrive owns the node (R10, AC10).
      if (node) return

      if (ctx.state === 'suspended') await ctx.resume()

      const { loopStart, loopEnd } = deriveLoopWindow(
        source.headDelaySeconds,
        source.loopSeconds,
        decoded.duration,
      )

      const next = ctx.createBufferSource()
      next.buffer = decoded
      next.loop = true
      next.loopStart = loopStart
      next.loopEnd = loopEnd
      next.connect(ctx.destination)
      // Offset by `loopStart`: the first pass through must skip the encoder
      // delay too, not only the repeats.
      next.start(0, loopStart)

      node = next
      startedAt = ctx.currentTime
      startPolling()
      notify()
    },

    stop() {
      // Halts and rewinds. There is no held position for the next press to
      // resume from, so `getElapsed()` reads 0 straight away (R8, AC9).
      releaseNode()
      startedAt = null
      stopPolling()
      notify()
    },

    isLoading() {
      return loading
    },

    isPlaying() {
      return node !== null
    },

    getElapsed() {
      if (!context || startedAt === null) return 0
      const elapsed = context.currentTime - startedAt - latencyOf(context)
      return Number.isFinite(elapsed) && elapsed > 0 ? elapsed : 0
    },

    getStartTime() {
      // The field the play/stop/dispose paths already maintain — no second
      // piece of state to keep in step, and no latency subtracted.
      return startedAt
    },

    subscribe(fn: () => void) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },

    dispose() {
      stopPolling()
      releaseNode()
      startedAt = null
      loading = false
      listeners.clear()
      buffer = null
      pending = null
      // The context is not closed: it belongs to the page, not to this player,
      // and the reference voice may still be sounding through it (R16, AC13).
      context = null
    },
  }
}
