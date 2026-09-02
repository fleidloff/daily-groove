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
import { scheduleLick } from '../lib/theory/phrase'

export type UseModeLick = {
  /**
   * Sound a mode's lick, from the day's root at the day's tempo. Best effort
   * and fire-and-forget: it returns nothing, never throws and never rejects, so
   * the card can put it beside a selection the selection does not depend on
   * (R19, R20).
   */
  playMode: (flavour: Flavour) => void
  /** Fetch and decode the rendered pitches in the background. Sounds nothing. */
  warm: () => void
}

export type UseModeLickInput = {
  /** Every rendered pitch, C4–B5, as `PITCHES` carries them. */
  pitches: PitchSample[]
  /** The day's root. Every lick is transposed to it. */
  root: Root
  /** The day's stated tempo, so the phrase is in time at 67 bpm and at 130 (R13). */
  bpm: number
  /**
   * The groove's beat grid, as `useTransport(source, bpm)` returns it. Handed
   * straight to the voice, which is what asks it and when — see below.
   */
  clock?: PhraseClock
  /** The one declared reference level, shared with the root row (R7). */
  level: number
  /** The one declared fade, the ramp on a note's tail and on a cancel (R5, R8). */
  fadeSeconds: number
  /** The page's single owner of the reference output (R8, R8a). */
  output: ReferenceOutput
  /** The injection seam — see below. */
  voice?: LickVoice
}

/**
 * Owns one `LickVoice` for the life of the component that calls it: built on
 * the first render, disposed on unmount, and never rebuilt in between — so the
 * decoded pitches survive every re-render the day's state causes, and a pitch
 * is fetched at most once per session (R32).
 *
 * `input.voice` is the injection seam, following `useReferenceNote`'s: a test
 * hands in a stand-in rather than mocking the module path this hook imports,
 * which is what keeps the feature refactorable behind its own tests (see
 * docs/testing.md). Every member of the input is read **once**, inside the lazy
 * initialiser — the page has one groove, so `useTransport` builds one clock and
 * `referenceOutput()` returns one owner, and both are stable for the component's
 * life. A caller passing a fresh object literal every render still gets one
 * voice.
 *
 * **This hook computes no time.** Where a phrase begins is the voice's question
 * to the clock, asked after the buffers land rather than at the moment of the
 * tap — a beat time read here would be a beat time in the past by the time
 * anything is scheduled. The clock is a value this hook forwards and nothing
 * more: it reads no transport, holds no reference to one and writes to none, so
 * a lick can land on the groove's beat without anything here being able to
 * stop, duck, move or restart it (R9, R10, R14).
 */
export function useModeLick(input: UseModeLickInput): UseModeLick {
  // Lazy initialiser, not a default parameter: a default would construct a
  // fresh voice — and a fresh buffer cache — on every render.
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

  /**
   * Every failure is swallowed here as well as in the voice. The voice's own
   * contract already says `play` never rejects, but this hook is what the card
   * calls from a click handler: an injected or future voice that breaks that
   * promise must not become an unhandled rejection in the page (R19, R20,
   * AC14).
   */
  const playMode = useCallback(
    (flavour: Flavour) => {
      try {
        // A mode with no lick is silence, not a claim on the output: an empty
        // phrase handed to the voice would take the shared sound over to play
        // nothing, cutting whatever the other row was still ringing (R8a).
        const notes = scheduleLick({ flavour, root, bpm })
        if (notes.length === 0) return
        void Promise.resolve(held.play(notes)).catch(() => {})
      } catch {
        // Deliberately ignored — see above.
      }
    },
    [held, root, bpm],
  )

  const warm = useCallback(() => {
    try {
      void Promise.resolve(held.warm()).catch(() => {})
    } catch {
      // Deliberately ignored — see above.
    }
  }, [held])

  return { playMode, warm }
}
