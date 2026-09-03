'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Flavour, Root } from '../types'
import type { PitchSample } from '../data/notes.generated'
import {
  createLickVoice,
  type LickVoice,
  type PhraseClock,
  type ReferenceOutput,
} from '../lib/audio/lick'
import { scheduleLick } from '@/lib/theory/phrase'

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

  const { root, bpm } = input

  const playMode = useCallback(
    (flavour: Flavour) => {
      try {
        const notes = scheduleLick({ flavour, root, bpm })
        if (notes.length === 0) return
        void Promise.resolve(held.play(notes)).catch(() => {})
      } catch {
        // A note that cannot sound must not break the press.
      }
    },
    [held, root, bpm],
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
