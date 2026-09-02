'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { createGrooveClock, type GrooveClock } from '../lib/audio/beat'
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
  /**
   * The beat grid for this groove. Built once, beside the transport, because
   * the transport is the only thing that knows when the groove started — and
   * handed back rather than kept, because the voice that schedules against it
   * is a sibling hook (R6, R8).
   */
  clock: GrooveClock
}

/**
 * The page's playback seam: it owns the transport's lifetime, its subscriptions
 * and the error flag a failed press raises, and nothing else.
 *
 * It constructs no I/O adapter of its own (R2). `createPageTransport` lives in
 * `lib/audio/transport.ts` and this hook only orchestrates it. `source` is read
 * once, when the transport is built — the page has one groove, and there is no
 * way to point a live transport at another (R6).
 *
 * `bpm` is read once too, and the beat grid it builds is returned alongside the
 * playback state: a tapped chip is scheduled against the groove's quarter note,
 * and the only thing that can place that grid on the graph's clock is the
 * transport (F16 E3 R6, R8). It is optional, and a missing tempo yields a grid
 * of zero, which degrades to an immediate note rather than to an error — the
 * behaviour every caller had before there was a grid at all (R7).
 *
 * `PageTransport` satisfies `BeatSource` structurally, and the direction is
 * one-way by construction: the clock's whole view of playback is
 * `getStartTime` and `subscribe`, so nothing reachable through it can stop,
 * move or reschedule the groove (R9).
 */
export function useTransport(
  source: PlayableSource,
  bpm?: number,
): UseTransport {
  // Held in state so both are stable across renders without reading a ref
  // during render. The transport builds its player on the first press, never
  // during render, so no `Audio` element exists during a server prerender.
  //
  // One initialiser for the pair, because the clock reads the transport: two
  // `useState` calls would let a future edit rebuild one without the other and
  // leave the grid pointed at a transport the page has forgotten.
  const [{ transport, clock }] = useState(() => {
    const built = createPageTransport(source)
    return { transport: built, clock: createGrooveClock(built, bpm ?? 0) }
  })
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

  return { isPlaying, loading, position, error, toggle, clock }
}
