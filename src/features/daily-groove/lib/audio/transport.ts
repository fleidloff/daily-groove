import {
  createAudioPlayer,
  type AudioPlayer,
  type PlayableSource,
} from './audio'
import { loopPosition } from './loop'

export type { PlayableSource }

export type PageTransport = {
  subscribe(fn: () => void): () => void
  isPlaying(): boolean
  isLoading(): boolean
  getPosition(): number
  getStartTime(): number | null
  toggle(): Promise<void>
  dispose(): void
}

export function createPageTransport(source: PlayableSource): PageTransport {
  const listeners = new Set<() => void>()

  let player: AudioPlayer | null = null
  let unsubscribe: (() => void) | null = null
  let running = false

  function notify() {
    for (const listener of Array.from(listeners)) listener()
  }

  function ensurePlayer(): AudioPlayer {
    if (player) return player
    const next = createAudioPlayer(source)
    player = next
    unsubscribe = next.subscribe(notify)
    return next
  }

  function releasePlayer() {
    unsubscribe?.()
    unsubscribe = null
    player?.stop()
    player?.dispose()
    player = null
  }

  return {
    subscribe(fn) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },

    isPlaying() {
      return running
    },

    isLoading() {
      return player?.isLoading() ?? false
    },

    getPosition() {
      if (!running || !player) return 0
      return loopPosition(player.getElapsed(), source.loopSeconds)
    },

    getStartTime() {
      if (!running || !player) return null
      return player.getStartTime()
    },

    async toggle() {
      if (running) {
        player?.stop()
        running = false
        notify()
        return
      }

      const next = ensurePlayer()
      running = true
      notify()

      try {
        await next.play()
      } catch (error) {
        running = false
        notify()
        throw error
      }
    },

    dispose() {
      releasePlayer()
      running = false
      listeners.clear()
    },
  }
}
