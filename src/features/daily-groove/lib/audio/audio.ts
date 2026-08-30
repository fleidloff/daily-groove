export type AudioPlayer = {
  /** Starts the loop from wherever the element stands — the top, after a stop. */
  play(): Promise<void>
  /** Halts playback and returns the loop to its start. Replaces `pause`. */
  stop(): void
  /** Position through the loop, 0..1. Zero when nothing has played yet. */
  getPosition(): number
  /**
   * Elapsed seconds into the file. The transport needs raw time to map onto the
   * musical loop, because the file is longer than the music it carries.
   */
  getCurrentTime(): number
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
 *
 * `opts.loop` repeats the source until it is stopped. It is the element's own
 * `loop` property, deliberately: re-triggering playback on `ended` would leave
 * an audible gap at the loop point.
 */
export function createAudioPlayer(
  src: string,
  opts?: { loop?: boolean },
): AudioPlayer {
  const element = new Audio(src)
  element.loop = opts?.loop ?? false

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
      // No reset here: `stop()` owns the rewind, so a press always starts the
      // loop from the top without play() having to say so.
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

    stop() {
      // Halts and rewinds: there is no held position for the next press to
      // resume from, and `getPosition()` reads 0 straight away.
      element.currentTime = 0
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

    getCurrentTime() {
      const { currentTime } = element
      return Number.isFinite(currentTime) && currentTime > 0 ? currentTime : 0
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
