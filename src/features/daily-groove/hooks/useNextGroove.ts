'use client'

import { useEffect, useState } from 'react'
import { nextDayStart } from '@/lib/date'
import type { NextGroove } from '../types'

const MINUTE = 60 * 1000

function remainingMs(today: Date): number {
  return nextDayStart(today).getTime() - Date.now()
}

function toNextGroove(remaining: number): NextGroove {
  if (remaining <= 0) return { ready: true }
  const minutes = Math.floor(remaining / MINUTE)
  return { ready: false, hours: Math.floor(minutes / 60), minutes: minutes % 60 }
}

export function useNextGroove(today: Date): NextGroove {
  const [remaining, setRemaining] = useState(() => remainingMs(today))

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    const schedule = (ms: number) => {
      if (ms <= 0) return
      timer = setTimeout(() => {
        const next = remainingMs(today)
        setRemaining(next)
        schedule(next)
      }, ms % MINUTE || MINUTE)
    }
    schedule(remainingMs(today))
    return () => {
      if (timer !== null) clearTimeout(timer)
    }
  }, [today])

  return toNextGroove(remaining)
}
