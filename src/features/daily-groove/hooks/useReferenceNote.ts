'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Root } from '../types'
import type { ReferenceNote } from '../data/notes.generated'
import {
  createReferenceVoice,
  type ReferenceVoice,
} from '../lib/audio/reference'

export type UseReferenceNote = {
  /**
   * Sound one root's reference note. Best effort and fire-and-forget: it
   * returns nothing, never throws and never rejects, so a caller can put it
   * beside a selection without the selection depending on it (R9, R10).
   */
  playRoot: (root: Root) => void
  /** Fetch and decode the whole row in the background. Sounds nothing (R18). */
  warm: () => void
}

/**
 * Owns one `ReferenceVoice` for the life of the component that calls it: built
 * on the first render, disposed on unmount, and never rebuilt in between — so
 * the decoded buffers survive every re-render the day's state causes (R17).
 *
 * `voice` is the injection seam, following `useSimpleMode`'s `store` parameter:
 * a test hands in a stand-in rather than mocking the module path the hook
 * imports, which is what keeps the feature refactorable behind its own tests
 * (see docs/testing.md). It is read once, when the voice is first held.
 *
 * Nothing here reads or touches the transport. The two voices share only the
 * `AudioContext` that `lib/audio/context.ts` owns, which is what lets a note
 * sound over a running groove without stopping, ducking or restarting it (R6).
 */
export function useReferenceNote(
  notes: ReferenceNote[],
  voice?: ReferenceVoice,
): UseReferenceNote {
  // Lazy initialiser, not a default parameter: a default would construct a
  // fresh voice — and a fresh buffer cache — on every render.
  const [held] = useState<ReferenceVoice>(() => voice ?? createReferenceVoice(notes))

  useEffect(() => {
    return () => {
      held.dispose()
    }
  }, [held])

  /**
   * Every failure is swallowed here as well as in the voice. The voice's own
   * contract already says `play` never rejects, but this hook is what the card
   * calls from a click handler: an injected or future voice that breaks that
   * promise must not become an unhandled rejection in the page (R10, AC8).
   */
  const playRoot = useCallback(
    (root: Root) => {
      try {
        void Promise.resolve(held.play(root)).catch(() => {})
      } catch {
        // Deliberately ignored — see above.
      }
    },
    [held],
  )

  const warm = useCallback(() => {
    try {
      void Promise.resolve(held.warm()).catch(() => {})
    } catch {
      // Deliberately ignored — see above.
    }
  }, [held])

  return { playRoot, warm }
}
