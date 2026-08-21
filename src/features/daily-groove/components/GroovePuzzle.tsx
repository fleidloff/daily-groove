'use client'

import { useMemo, useRef, useState, useSyncExternalStore } from 'react'
import { useStore } from 'zustand'
import type { Attribute, Groove } from '../types'
import {
  createDailyGrooveStore,
  type DailyGrooveState,
} from '../hooks/useDailyGrooveStore'
import { createAudioPlayer, type AudioPlayer } from '../lib/audio'
import { buildOptions } from '../lib/options'
import { isoDate, selectGrooveForDate } from '../lib/selectGroove'
import {
  GROOVES,
  SCALE_POOL,
  CHORD_POOL,
  PROGRESSION_POOL,
} from '../lib/seed'
import { useProgress } from '../hooks/useProgress'
import { AttributeSelector } from './AttributeSelector'
import { AttributePicker } from './AttributePicker'
import { ResultBreakdown, type BreakdownRow } from './ResultBreakdown'
import { AlreadyPlayed } from './AlreadyPlayed'
import { StreakBadge } from './StreakBadge'
import { HistoryView } from './HistoryView'
import { PlayControl } from '@/components/PlayControl'

type GroovePuzzleProps = {
  groove?: Groove
}

// Fixed display order for attributes, independent of selection order.
const ATTRIBUTE_ORDER: Attribute[] = ['scale', 'chord', 'progression']

const POOLS: Record<Attribute, string[]> = {
  scale: SCALE_POOL,
  chord: CHORD_POOL,
  progression: PROGRESSION_POOL,
}

// A no-op subscription: today's groove never changes within a session, so the
// external store never notifies. Defined once so the subscription is stable.
const subscribeNoop = () => () => {}

/**
 * The daily puzzle: play today's groove, opt into any subset of {scale, chord,
 * progression}, guess those, submit, and see a per-attribute breakdown. When no
 * groove is provided it resolves today's on the client only, so the daily
 * selection reflects the viewer's calendar day and no build-time groove is
 * baked into the static HTML. `useSyncExternalStore` renders the server
 * snapshot (undefined → a loading state) and switches to the client snapshot
 * after hydration, with no mismatch.
 */
export function GroovePuzzle({ groove }: GroovePuzzleProps) {
  const resolved = useSyncExternalStore<Groove | undefined>(
    subscribeNoop,
    () => groove ?? selectGrooveForDate(new Date(), GROOVES),
    () => groove,
  )

  if (!resolved) {
    return (
      <section aria-label="Daily Groove">
        <p>Loading today&apos;s groove…</p>
      </section>
    )
  }

  return <GroovePuzzleView groove={resolved} />
}

/**
 * Renders a puzzle for a concrete groove. Split out so the Zustand store and
 * audio player are only created once a groove is known.
 */
function GroovePuzzleView({ groove }: { groove: Groove }) {
  // Today's ISO calendar day, used both to select the groove and to key the
  // saved result. Persistence (streak/history/today's result) is loaded via
  // useProgress; no component reads localStorage directly (R6).
  const today = isoDate(new Date())
  const { todayResult, streak, history, save, loaded } = useProgress(today)

  // One store instance per puzzle, created once. Held in state (not a ref) so it
  // is stable across renders without reading a ref during render.
  const [store] = useState(() => createDailyGrooveStore(groove))

  const selectedAttrs = useStore(store, (s: DailyGrooveState) => s.selectedAttrs)
  const guesses = useStore(store, (s: DailyGrooveState) => s.guesses)
  const submitted = useStore(store, (s: DailyGrooveState) => s.submitted)
  const result = useStore(store, (s: DailyGrooveState) => s.result)
  const toggleAttribute = useStore(
    store,
    (s: DailyGrooveState) => s.toggleAttribute,
  )
  const setGuess = useStore(store, (s: DailyGrooveState) => s.setGuess)
  const submit = useStore(store, (s: DailyGrooveState) => s.submit)

  // Deterministic per-day option sets for every attribute; selection only
  // decides which pickers render, not what their options are.
  const optionsByAttr = useMemo(() => {
    const day = isoDate(new Date())
    const byAttr = {} as Record<Attribute, string[]>
    for (const attribute of ATTRIBUTE_ORDER) {
      byAttr[attribute] = buildOptions(
        groove[attribute],
        POOLS[attribute],
        `${day}:${attribute}`,
      )
    }
    return byAttr
  }, [groove])

  // Constructed lazily on first play — a user gesture on the client — so no
  // Audio element is created during render or server prerender.
  const playerRef = useRef<AudioPlayer | null>(null)
  const [isPlaying, setIsPlaying] = useState(false)
  const [audioError, setAudioError] = useState(false)

  async function handlePlay() {
    setAudioError(false)
    setIsPlaying(true)
    try {
      if (!playerRef.current) {
        playerRef.current = createAudioPlayer(groove.audioSrc)
      }
      await playerRef.current.play()
    } catch {
      setAudioError(true)
    } finally {
      setIsPlaying(false)
    }
  }

  // Score via the store, then persist the built result (R1). The store builds
  // and exposes the DailyResult synchronously on submit; read it back and save.
  async function handleSubmit() {
    submit()
    const built = store.getState().result
    if (built) await save(built)
  }

  const nothingSelected = selectedAttrs.length === 0

  // Show the already-played view only for a result loaded from storage — not for
  // the one just submitted this session (that keeps its own breakdown, including
  // skipped rows). `submitted` is the in-session flag.
  const showAlreadyPlayed = loaded && todayResult !== null && !submitted

  const breakdownRows: BreakdownRow[] = ATTRIBUTE_ORDER.map((attribute) => {
    const attempted = selectedAttrs.includes(attribute)
    return {
      attribute,
      attempted,
      guess: attempted ? guesses[attribute] : undefined,
      correct: result?.correctness[attribute],
      answer: groove[attribute],
    }
  })

  return (
    <section aria-label="Daily Groove">
      <StreakBadge streak={streak} />

      {audioError && (
        <div role="alert">
          <p>Couldn&apos;t play the groove.</p>
          <button type="button" onClick={handlePlay}>
            Retry
          </button>
        </div>
      )}

      {showAlreadyPlayed && todayResult ? (
        // A result already exists for today: block re-guessing, reveal it, and
        // keep replay working (R2, AC2).
        <AlreadyPlayed
          result={todayResult}
          groove={groove}
          onReplay={handlePlay}
          isPlaying={isPlaying}
        />
      ) : (
        <>
          <PlayControl onPlay={handlePlay} isPlaying={isPlaying} />

          {!submitted && (
            <>
              <AttributeSelector
                selected={selectedAttrs}
                onToggle={toggleAttribute}
                disabled={submitted}
              />

              {ATTRIBUTE_ORDER.filter((a) => selectedAttrs.includes(a)).map(
                (attribute) => (
                  <AttributePicker
                    key={attribute}
                    attribute={attribute}
                    options={optionsByAttr[attribute]}
                    value={guesses[attribute] ?? null}
                    onSelect={(v) => setGuess(attribute, v)}
                    disabled={submitted}
                  />
                ),
              )}

              {nothingSelected && (
                <p role="note">Select at least one attribute to guess.</p>
              )}

              <button
                type="button"
                onClick={handleSubmit}
                disabled={nothingSelected}
              >
                Submit
              </button>
            </>
          )}

          {submitted && result && <ResultBreakdown rows={breakdownRows} />}
        </>
      )}

      <HistoryView results={history} />
    </section>
  )
}
