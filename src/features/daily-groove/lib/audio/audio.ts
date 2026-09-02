import { sharedAudioContext } from './context'
import { deriveLoopWindow } from './loop'

export type PlayableSource = {
  src: string
  loopSeconds: number
  headDelaySeconds: number
}

export type AudioPlayer = {
  load(): Promise<void>
  play(): Promise<void>
  stop(): void
  isLoading(): boolean
  isPlaying(): boolean
  getElapsed(): number
  getStartTime(): number | null
  subscribe(fn: () => void): () => void
  dispose(): void
}

// Both are optional at runtime whatever lib.dom says: Safari reports only
// baseLatency, and older engines neither.
type LatencyReporting = {
  outputLatency?: number
  baseLatency?: number
}

function latencyOf(context: AudioContext): number {
  const reported = context as LatencyReporting
  const latency = reported.outputLatency ?? reported.baseLatency ?? 0
  return Number.isFinite(latency) && latency > 0 ? latency : 0
}

export function createAudioPlayer(source: PlayableSource): AudioPlayer {
  const listeners = new Set<() => void>()

  let context: AudioContext | null = null
  let buffer: AudioBuffer | null = null
  let pending: Promise<AudioBuffer> | null = null
  let node: AudioBufferSourceNode | null = null
  let startedAt: number | null = null
  let loading = false
  let frame: number | null = null

  function notify() {
    for (const listener of Array.from(listeners)) listener()
  }

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
    const ctx = sharedAudioContext()
    context = ctx

    const response = await fetch(source.src)
    if (!response.ok) {
      throw new Error(`Could not fetch ${source.src}: ${response.status}`)
    }
    return await ctx.decodeAudioData(await response.arrayBuffer())
  }

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
      next.start(0, loopStart)

      node = next
      startedAt = ctx.currentTime
      startPolling()
      notify()
    },

    stop() {
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
      context = null
    },
  }
}
