'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { createPageTransport, type PlayableSource } from '../lib/audio/transport'

export type UseTransport = {
  /** Whether the page's groove is currently sounding. */
  isPlaying: boolean
  /**
   * Whether a press is still fetching and decoding, with nothing audible yet.
   * The play control renders inert while it holds (R7a).
   */
  loading: boolean
  /** Position through the loop, 0..1. */
  position: number
  /** Whether the last toggle failed to start. Cleared by the next toggle. */
  error: boolean
  /** Starts the groove, or stops it if it is already running. */
  toggle(): Promise<void>
}

/**
 * The page's playback seam: it owns the transport's lifetime, its subscriptions
 * and the error flag a failed press raises, and nothing else.
 *
 * It constructs no I/O adapter of its own (R2). `createPageTransport` lives in
 * `lib/audio/transport.ts` and this hook only orchestrates it. `source` is read
 * once, when the transport is built — the page has one groove, and there is no
 * way to point a live transport at another (R6).
 */
export function useTransport(source: PlayableSource): UseTransport {
  // Held in state so it is stable across renders without reading a ref during
  // render. The transport builds its player on the first press, never during
  // render, so no `Audio` element exists during a server prerender.
  const [transport] = useState(() => createPageTransport(source))
  const [error, setError] = useState(false)

  useEffect(() => () => transport.dispose(), [transport])

  // Playback state is read straight off the transport rather than mirrored into
  // React state, so the progress bar follows the real position frame by frame.
  // One subscription covers both: the transport notifies on start, on stop and
  // throughout playback.
  const isPlaying = useSyncExternalStore(
    transport.subscribe,
    transport.isPlaying,
    () => false,
  )
  const position = useSyncExternalStore(
    transport.subscribe,
    transport.getPosition,
    () => 0,
  )
  // Web Audio has no progressive playback, so the press and the first sound are
  // separated by a fetch and a decode. That gap is transport state like any
  // other, read through the same subscription rather than latched here: a flag
  // the hook owned could outlive the press that set it.
  const loading = useSyncExternalStore(
    transport.subscribe,
    transport.isLoading,
    () => false,
  )

  const toggle = useCallback(async () => {
    setError(false)
    try {
      await transport.toggle()
    } catch {
      setError(true)
    }
  }, [transport])

  return { isPlaying, loading, position, error, toggle }
}
