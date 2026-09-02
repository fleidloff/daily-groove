'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Root } from '../types'
import type { ReferenceNote } from '../data/notes.generated'
import type { GrooveClock } from '../lib/audio/beat'
import {
  createReferenceVoice,
  type ReferenceVoice,
} from '../lib/audio/reference'

export type UseReferenceNote = {
  playRoot: (root: Root) => void
  warm: () => void
}

type ReferenceNoteOptions = {
  clock?: GrooveClock
  voice?: ReferenceVoice
}

export function useReferenceNote(
  notes: ReferenceNote[],
  options?: ReferenceNoteOptions,
): UseReferenceNote {
  const [held] = useState<ReferenceVoice>(
    () => options?.voice ?? createReferenceVoice(notes, options?.clock),
  )

  useEffect(() => {
    return () => {
      held.dispose()
    }
  }, [held])

  const playRoot = useCallback(
    (root: Root) => {
      try {
        void Promise.resolve(held.play(root)).catch(() => {})
      } catch {
        // A note that cannot sound must not break the press.
      }
    },
    [held],
  )

  const warm = useCallback(() => {
    try {
      void Promise.resolve(held.warm()).catch(() => {})
    } catch {
      // A note that cannot sound must not break the press.
    }
  }, [held])

  return { playRoot, warm }
}
