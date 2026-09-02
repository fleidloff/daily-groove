'use client'

import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'
import { createGrooveClock, type GrooveClock } from '../lib/audio/beat'
import { createPageTransport, type PlayableSource } from '../lib/audio/transport'

export type UseTransport = {
  isPlaying: boolean
  loading: boolean
  position: number
  error: boolean
  toggle(): Promise<void>
  clock: GrooveClock
}

export function useTransport(
  source: PlayableSource,
  bpm?: number,
): UseTransport {
  const [{ transport, clock }] = useState(() => {
    const built = createPageTransport(source)
    return { transport: built, clock: createGrooveClock(built, bpm ?? 0) }
  })
  const [error, setError] = useState(false)

  useEffect(() => () => transport.dispose(), [transport])

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
