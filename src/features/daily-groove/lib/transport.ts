import { createAudioPlayer, type AudioPlayer } from './audio'

/** A groove the page can play: what to sound, and who is sounding it. */
export type PlayableSource = { id: string; src: string }

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
      return player.getPosition()
    },

    async toggle(source) {
      if (soundingId === source.id) {
        player?.stop()
        soundingId = null
        notify()
        return
      }

      const next = ensurePlayerFor(source)
      soundingId = source.id
      notify()

      try {
        await next.play()
      } catch (error) {
        // Load/play failures propagate so the caller can surface a retry. The
        // transport rolls back first: nothing sounds, so no control is left
        // showing a stop affordance for a groove that never started.
        if (soundingId === source.id) {
          soundingId = null
          notify()
        }
        throw error
      }
    },

    dispose() {
      releasePlayer()
      soundingId = null
      listeners.clear()
    },
  }
}
