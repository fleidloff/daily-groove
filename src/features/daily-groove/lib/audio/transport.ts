import {
  createAudioPlayer,
  type AudioPlayer,
  type PlayableSource,
} from './audio'
import { loopPosition } from './loop'

/**
 * The one groove this page plays: what to sound, how long its loop is, and
 * where inside its file the music starts.
 *
 * Declared by the player and re-exported here, so the page keeps naming the
 * transport as the thing it hands a source to. There is one such type, not two
 * that have to be kept in step.
 */
export type { PlayableSource }

export type PageTransport = {
  subscribe(fn: () => void): () => void
  /** Whether the source is currently sounding. */
  isPlaying(): boolean
  /** Whether a press is still fetching and decoding, with nothing audible. */
  isLoading(): boolean
  /** Position through the loop, 0..1. */
  getPosition(): number
  /**
   * The player's start time while running; null when stopped or still loading.
   *
   * The graph time the groove's first sample was *emitted* at, not the
   * latency-corrected time it was heard at. `getPosition()` is built on the
   * heard timeline because it draws what the listener is hearing; a note
   * scheduled against that timeline would arrive one output latency behind the
   * beat, so the beat grid reads this one instead. Read-only in the strongest
   * sense: nothing reachable from here can stop, move or reschedule the
   * groove (R9).
   */
  getStartTime(): number | null
  /** Starts the source, or stops it if it is already running. */
  toggle(): Promise<void>
  dispose(): void
}

/**
 * The page's single owner of playback, built for a single groove.
 *
 * The source is captured at construction and there is no way to supply another
 * one, so "which groove is sounding" is not a question anything can ask: the
 * page has one groove, and the only state left is whether it is running (R5,
 * R6).
 *
 * The player is built lazily, on the first press, so no `AudioContext` exists
 * during render or server prerender (R6, AC7). React still needs a stable
 * `subscribe` from the first render, so the transport owns the listener set and
 * forwards the player's notifications into it once a player exists.
 *
 * Position is arithmetic and nothing else: the player reports latency-corrected
 * elapsed seconds on the graph's own clock, and `loopPosition` maps them onto
 * the loop this transport was constructed for. Because it is derived on every
 * read rather than counted forward, it wraps at the loop boundary for free and
 * a frozen animation frame — a backgrounded tab — costs no accuracy (R2).
 */
export function createPageTransport(source: PlayableSource): PageTransport {
  const listeners = new Set<() => void>()

  // The one live player, built once and kept. A stopped player is retained, so
  // pressing again restarts it without re-fetching or re-decoding the file;
  // `stop()` rewinds, so that restart still begins at bar 1.
  let player: AudioPlayer | null = null
  let unsubscribe: (() => void) | null = null
  let running = false

  function notify() {
    // Copy first: a listener may unsubscribe while being notified.
    for (const listener of Array.from(listeners)) listener()
  }

  function ensurePlayer(): AudioPlayer {
    if (player) return player
    const next = createAudioPlayer(source)
    player = next
    unsubscribe = next.subscribe(notify)
    return next
  }

  /** Stops, unsubscribes and releases the player, if there is one. */
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
      // Only the player knows: the gap it covers is a fetch and a decode, both
      // of which belong to the file rather than to the press (R7a).
      return player?.isLoading() ?? false
    },

    getPosition() {
      if (!running || !player) return 0
      return loopPosition(player.getElapsed(), source.loopSeconds)
    },

    getStartTime() {
      // Null while a press is still fetching and decoding: `running` is
      // already true, but the player has no start time until a source has
      // actually been handed to the graph, and a tap in that gap has no beat
      // to wait for (R7).
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
        // Load/play failures propagate so the caller can surface a retry. The
        // transport rolls back first: nothing sounds, so no control is left
        // showing a stop affordance for a groove that never started. The
        // player clears its own busy state, so the press leaves neither (R7,
        // AC8, AC8d).
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
