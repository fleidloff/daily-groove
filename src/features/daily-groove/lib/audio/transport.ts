import { createAudioPlayer, type AudioPlayer } from './audio'

/** A groove the page can play: what to sound, and who is sounding it. */
export type PlayableSource = {
  id: string
  src: string
  /**
   * The musical length of the loop in seconds, from `loopSecondsOf(groove)`.
   * Optional: without it the transport falls back to the file's own duration,
   * which is what an archive entry with no resolved groove gets.
   */
  loopSeconds?: number
}

/**
 * The encoder delay at the head of every mp3 in this catalogue, in seconds.
 *
 * `ffmpeg`'s mp3 encoder emits 1105 samples of silence before the first real
 * sample, and at 44.1kHz that is 25.057ms. It is identical across all sixteen
 * files because they came off one encoder configuration; re-derive it with
 * `ffprobe -show_entries stream=start_time public/grooves/groove-01.mp3` if the
 * pipeline ever changes.
 *
 * It matters because `HTMLAudioElement` does not hide it. `currentTime` 0 is the
 * start of the *file*, not the downbeat, so a position taken as
 * `currentTime / duration` puts the four bar lines ~25ms ahead of the music.
 */
export const HEAD_DELAY_SECONDS = 1105 / 44100

export type PageTransport = {
  subscribe(fn: () => void): () => void
  /** The id of the groove currently sounding, or null. */
  getSoundingId(): string | null
  /** Position through the sounding loop, 0..1. */
  getPosition(): number
  /** Toggles `source`: starts it, or stops it if it is already sounding. */
  toggle(source: PlayableSource): Promise<void>
  dispose(): void
}

/**
 * The page's single owner of playback.
 *
 * Exclusivity is structural rather than a rule anyone has to remember: there is
 * at most one `AudioPlayer`, so the page physically cannot sound two grooves
 * (R3, R4). Every control asks the same question — `getSoundingId() === myId` —
 * which is why today's full-width button and today's card control light up
 * together with no special case.
 *
 * The player is built lazily, on the first press, so no `Audio` element exists
 * during render or server prerender. React still needs a stable `subscribe`
 * from the first render, so the transport owns the listener set and forwards
 * the current player's notifications into it once a player exists.
 */
export function createPageTransport(): PageTransport {
  const listeners = new Set<() => void>()

  // The one live player, and the source it was built for. `soundingId` is
  // narrower than `playerId`: a stopped player is kept, so pressing the same
  // groove again restarts it without rebuilding the media element. `stop()`
  // rewinds, so that restart still begins at bar 1 (R3).
  let player: AudioPlayer | null = null
  let playerId: string | null = null
  let unsubscribe: (() => void) | null = null
  let soundingId: string | null = null
  // The loop length declared by whatever is sounding, so `getPosition` can map
  // elapsed seconds onto the music rather than onto the file.
  let loopSeconds: number | null = null

  function notify() {
    // Copy first: a listener may unsubscribe while being notified.
    for (const listener of Array.from(listeners)) listener()
  }

  /** Stops, unsubscribes and releases the current player, if there is one. */
  function releasePlayer() {
    unsubscribe?.()
    unsubscribe = null
    player?.stop()
    player?.dispose()
    player = null
    playerId = null
  }

  function ensurePlayerFor(source: PlayableSource): AudioPlayer {
    if (player && playerId === source.id) return player
    // A different source: the old player goes entirely. Merely stopping it
    // would leave its position poll and its subscription alive (R4).
    releasePlayer()
    // Every player loops, an archive groove included (R12, AC14).
    const next = createAudioPlayer(source.src, { loop: true })
    player = next
    playerId = source.id
    unsubscribe = next.subscribe(notify)
    return next
  }

  return {
    subscribe(fn) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },

    getSoundingId() {
      return soundingId
    },

    getPosition() {
      if (soundingId === null || !player) return 0
      // Without a declared loop length there is nothing better than the file's
      // own duration, delay and padding included.
      if (loopSeconds === null || loopSeconds <= 0) return player.getPosition()

      // Elapsed time measured from the downbeat, not from the head of the file.
      const elapsed = player.getCurrentTime() - HEAD_DELAY_SECONDS
      if (!Number.isFinite(elapsed) || elapsed <= 0) return 0
      return Math.min(elapsed / loopSeconds, 1)
    },

    async toggle(source) {
      if (soundingId === source.id) {
        player?.stop()
        soundingId = null
        loopSeconds = null
        notify()
        return
      }

      const next = ensurePlayerFor(source)
      soundingId = source.id
      loopSeconds = source.loopSeconds ?? null
      notify()

      try {
        await next.play()
      } catch (error) {
        // Load/play failures propagate so the caller can surface a retry. The
        // transport rolls back first: nothing sounds, so no control is left
        // showing a stop affordance for a groove that never started.
        if (soundingId === source.id) {
          soundingId = null
          loopSeconds = null
          notify()
        }
        throw error
      }
    },

    dispose() {
      releasePlayer()
      soundingId = null
      loopSeconds = null
      listeners.clear()
    },
  }
}
