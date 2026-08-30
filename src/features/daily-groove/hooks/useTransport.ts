'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { createPageTransport, type PlayableSource } from '../lib/audio/transport'

export type UseTransport = {
  /** The id of the groove currently sounding, or null. */
  soundingId: string | null
  /** Position through the sounding loop, 0..1. */
  position: number
  /** Whether the last toggle failed to start. Cleared by the next toggle. */
  error: boolean
  /** Starts `source`, or stops it if it is already the one sounding. */
  toggle(source: PlayableSource): Promise<void>
}

/**
 * The page's playback seam: it owns the transport's lifetime, its subscriptions
 * and the error flag a failed press raises, and nothing else.
 *
 * It constructs no I/O adapter of its own (R2). `createPageTransport` lives in
 * `lib/audio/transport.ts` and this hook only orchestrates it — which is also
 * why exclusivity is absent here: one transport physically cannot sound two
 * grooves, so it is structural in the adapter rather than a rule any consumer
 * has to remember.
 */
export function useTransport(): UseTransport {
  // Held in state so it is stable across renders without reading a ref during
  // render. The transport builds its player on the first press, never during
  // render, so no `Audio` element exists during a server prerender.
  const [transport] = useState(() => createPageTransport())
  const [error, setError] = useState(false)

  useEffect(() => () => transport.dispose(), [transport])

  // Playback state is read straight off the transport rather than mirrored into
  // React state, so the progress bar follows the real position frame by frame.
  // One subscription covers both: the transport notifies on start, on stop and
  // throughout playback.
  const soundingId = useSyncExternalStore(
    transport.subscribe,
    transport.getSoundingId,
    () => null,
  )
  const position = useSyncExternalStore(
    transport.subscribe,
    transport.getPosition,
    () => 0,
  )

  const toggle = useCallback(
    async (source: PlayableSource) => {
      setError(false)
      try {
        await transport.toggle(source)
      } catch {
        setError(true)
      }
    },
    [transport],
  )

  return { soundingId, position, error, toggle }
}
