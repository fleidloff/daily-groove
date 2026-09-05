'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Flavour, Root } from '../types'
import type { PitchSample } from '../data/notes.generated'
import {
  createLickVoice,
  type LickVoice,
  type PhraseClock,
  type ReferenceOutput,
} from '../lib/audio/lick'
import { scheduleLick } from '@/lib/theory/phrase'
import { LICK_VARIATIONS } from '@/lib/theory/licks'
import { hashString } from '@/lib/hash'

export type UseModeLick = {
  playMode: (flavour: Flavour) => void
  warm: () => void
}

export type UseModeLickInput = {
  pitches: PitchSample[]
  root: Root
  bpm: number
  clock?: PhraseClock
  level: number
  fadeSeconds: number
  output: ReferenceOutput
  voice?: LickVoice
  seed?: string
}

export function variationFor(seed: string | undefined): number {
  if (seed === undefined || seed === '') return 0
  return hashString(seed) % LICK_VARIATIONS
}

export function useModeLick(input: UseModeLickInput): UseModeLick {
  const [held] = useState<LickVoice>(
    () =>
      input.voice ??
      createLickVoice({
        pitches: input.pitches,
        output: input.output,
        level: input.level,
        fadeSeconds: input.fadeSeconds,
        clock: input.clock,
      }),
  )

  useEffect(() => {
    return () => {
      held.dispose()
    }
  }, [held])

  const { root, bpm, seed } = input
  const variation = useMemo(() => variationFor(seed), [seed])

  const playMode = useCallback(
    (flavour: Flavour) => {
      try {
        const notes = scheduleLick({ flavour, root, bpm, variation })
        if (notes.length === 0) return
        void Promise.resolve(held.play(notes)).catch(() => {})
      } catch {
        // A note that cannot sound must not break the press.
      }
    },
    [held, root, bpm, variation],
  )

  const warm = useCallback(() => {
    try {
      void Promise.resolve(held.warm()).catch(() => {})
    } catch {
      // A note that cannot sound must not break the press.
    }
  }, [held])

  return { playMode, warm }
}
