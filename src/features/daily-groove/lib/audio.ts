export type AudioPlayer = {
  /** Starts the loop, or resumes it from the held position. */
  play(): Promise<void>
  /** Pauses at the current position; it is not reset. */
  pause(): void
  /** Position through the loop, 0..1. Zero when nothing has played yet. */
  getPosition(): number
  isPlaying(): boolean
  /** Subscribes to position/state changes. Returns an unsubscribe. */
  subscribe(fn: () => void): () => void
  dispose(): void
}

/**
 * Wraps an HTML5 `Audio` element. Nothing outside this module touches the
 * element directly.
 *
 * Position is polled with `requestAnimationFrame` while playing rather than
 * read from the element's `timeupdate` event, which fires roughly four times a
 * second — too coarse to move a bar highlight cleanly. The subscribe/snapshot
 * pair lets React read the player through `useSyncExternalStore`.
 */
export function createAudioPlayer(src: string): AudioPlayer {
  const element = new Audio(src)
  // The groove is a loop: it never ends on its own.
  element.loop = true

  const listeners = new Set<() => void>()
  let playing = false
  let frame: number | null = null

  function notify() {
    // Copy first: a listener may unsubscribe while being notified.
    for (const listener of Array.from(listeners)) listener()
  }

  function tick() {
    frame = requestAnimationFrame(tick)
    notify()
  }

  function startPolling() {
    if (frame === null) frame = requestAnimationFrame(tick)
  }

  function stopPolling() {
    if (frame !== null) {
      cancelAnimationFrame(frame)
      frame = null
    }
  }

  return {
    async play() {
      // Deliberately no `currentTime = 0`: play resumes, it does not restart.
      const started = Promise.resolve(element.play())
      playing = true
      startPolling()
      notify()

      try {
        await started
      } catch (error) {
        // Load/play failures propagate so the UI can surface a retry.
        playing = false
        stopPolling()
        notify()
        throw error
      }
    },

    pause() {
      element.pause()
      playing = false
      stopPolling()
      notify()
    },

    getPosition() {
      const { duration, currentTime } = element
      if (!Number.isFinite(duration) || duration <= 0) return 0
      const position = currentTime / duration
      if (!Number.isFinite(position)) return 0
      return Math.min(Math.max(position, 0), 1)
    },

    isPlaying() {
      return playing
    },

    subscribe(fn: () => void) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },

    dispose() {
      stopPolling()
      playing = false
      listeners.clear()
      element.pause()
      // Release the media resource.
      element.src = ''
    },
  }
}
