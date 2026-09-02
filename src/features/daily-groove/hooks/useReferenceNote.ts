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
  /**
   * Sound one root's reference note. Best effort and fire-and-forget: it
   * returns nothing, never throws and never rejects, so a caller can put it
   * beside a selection without the selection depending on it (R9, R10).
   */
  playRoot: (root: Root) => void
  /** Fetch and decode the whole row in the background. Sounds nothing (R18). */
  warm: () => void
}

/** What the hook may be handed instead of building it itself. */
type ReferenceNoteOptions = {
  /**
   * The groove's beat grid, so a tapped note lands on the next quarter note
   * rather than wherever the thumb fell (F16 E3 R6). Omitted, every note is
   * immediate.
   */
  clock?: GrooveClock
  /** The injection seam — see below. */
  voice?: ReferenceVoice
}

/**
 * Owns one `ReferenceVoice` for the life of the component that calls it: built
 * on the first render, disposed on unmount, and never rebuilt in between — so
 * the decoded buffers survive every re-render the day's state causes (R17).
 *
 * `options.voice` is the injection seam, following `useSimpleMode`'s `store`
 * parameter: a test hands in a stand-in rather than mocking the module path the
 * hook imports, which is what keeps the feature refactorable behind its own
 * tests (see docs/testing.md). An options object rather than a third positional
 * parameter, so the page never has to pass `undefined` for a test-only seam.
 * Both members are read once, when the voice is first held.
 *
 * This hook reads the transport's clock and writes nothing to it (F16 E3 R9).
 * `options.clock` is a grid and nothing more — three read-only methods — so a
 * note can be placed on the groove's beat without anything here being able to
 * stop, duck, move or restart it. The two voices otherwise share only the
 * `AudioContext` that `lib/audio/context.ts` owns (R6).
 */
export function useReferenceNote(
  notes: ReferenceNote[],
  options?: ReferenceNoteOptions,
): UseReferenceNote {
  // Lazy initialiser, not a default parameter: a default would construct a
  // fresh voice — and a fresh buffer cache — on every render. The options are
  // read inside it, so a caller passing a fresh object literal every render
  // still gets one voice.
  const [held] = useState<ReferenceVoice>(
    () => options?.voice ?? createReferenceVoice(notes, options?.clock),
  )

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
