'use client'

import { PlayControl } from '@/components/PlayControl'
import type { Attribute, DailyResult, Groove } from '../types'
import { ResultBreakdown, type BreakdownRow } from './ResultBreakdown'

type AlreadyPlayedProps = {
  result: DailyResult
  onReplay: () => void
  isPlaying: boolean
  // The day's groove, so the breakdown can reveal each attribute's true answer.
  // Optional: without it we fall back to the stored guess (DailyResult carries
  // no answer strings of its own).
  groove?: Groove
}

const ATTRIBUTES: Attribute[] = ['scale', 'chord', 'progression']

/**
 * The already-played state for a day that already has a saved result. Shows the
 * stored per-attribute breakdown and a replay control, but renders no guess
 * inputs — the day cannot be re-played.
 *
 * When the day's `groove` is supplied, each attempted attribute reveals the
 * groove's true value; otherwise it falls back to the stored guess, since
 * `DailyResult` carries only guesses and per-attribute correctness.
 */
export function AlreadyPlayed({
  result,
  onReplay,
  isPlaying,
  groove,
}: AlreadyPlayedProps) {
  const rows: BreakdownRow[] = ATTRIBUTES.filter(
    (attribute) => attribute in result.guesses,
  ).map((attribute) => {
    const guess = result.guesses[attribute] ?? ''
    return {
      attribute,
      attempted: true,
      guess,
      correct: result.correctness[attribute],
      // Reveal the groove's true value when known; else surface the guess.
      answer: groove ? groove[attribute] : guess,
    }
  })

  return (
    <section aria-label="Already played today">
      <ResultBreakdown rows={rows} />
      <PlayControl onPlay={onReplay} isPlaying={isPlaying} label="Replay" />
    </section>
  )
}
