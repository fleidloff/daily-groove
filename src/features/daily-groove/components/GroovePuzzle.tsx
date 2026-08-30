'use client'

import { useCallback, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { Groove } from '../types'
import { toArchiveEntries, type ArchiveEntry } from '../lib/presentation/archive'
import { resolveGrooveForResult } from '../lib/puzzle/resolveGroove'
import type { PlayableSource } from '../lib/audio/transport'
import { dotStates, selectFeedback, shouldShowNudge } from '../lib/presentation/feedback'
import { flavourOptions, ROOTS, loopSecondsOf } from '../lib/theory/music'
import { isoDate, selectGrooveForDate } from '../lib/puzzle/selectGroove'
import { GROOVES } from '../data/grooves.generated'
import { usePuzzleSession } from '../hooks/usePuzzleSession'
import { useTransport } from '../hooks/useTransport'
import { ArchiveStrip, type ArchiveStripEntry } from './archive/ArchiveStrip'
import { GrooveCard } from './puzzle/GrooveCard'
import { GrooveHeader } from './header/GrooveHeader'
import { GuessCard } from './puzzle/GuessCard'
import { SolvedPanel } from './puzzle/SolvedPanel'
import { TransportPanel } from './puzzle/TransportPanel'
import { Card } from '@/components/surfaces/Card'
import { PlayControl } from '@/components/controls/PlayControl'
import { Row } from '@/components/layout/Row'
import { Stack } from '@/components/layout/Stack'
import { Text } from '@/components/typography/Text'

type GroovePuzzleProps = {
  groove?: Groove
}

// A no-op subscription: today's groove never changes within a session, so the
// external store never notifies. Defined once so the subscription is stable.
const subscribeNoop = () => () => {}

/**
 * What the page shows before it knows enough to show a game: while today's
 * groove is resolving on the client, and again while the day's saved record is
 * being read. Both are the same wait as far as the player is concerned.
 */
function PuzzleLoading() {
  return (
    <section aria-label="Daily Groove">
      <Text tone="muted">Loading today&apos;s groove…</Text>
    </section>
  )
}

/**
 * The daily puzzle: play today's groove, then name its root and its flavour.
 * When no groove is provided it resolves today's on the client only, so the
 * daily selection reflects the viewer's calendar day and no build-time groove
 * is baked into the static HTML. `useSyncExternalStore` renders the server
 * snapshot (undefined → a loading state) and switches to the client snapshot
 * after hydration, with no mismatch.
 */
export function GroovePuzzle({ groove }: GroovePuzzleProps) {
  const resolved = useSyncExternalStore<Groove | undefined>(
    subscribeNoop,
    () => groove ?? selectGrooveForDate(new Date(), GROOVES),
    () => groove,
  )

  if (!resolved) return <PuzzleLoading />

  return <GroovePuzzleView groove={resolved} />
}

/**
 * Renders a puzzle for a concrete groove. Split out so the day's session and
 * its audio transport are only created once a groove is known.
 *
 * Composition only. The day's state lives in `usePuzzleSession` and playback in
 * `useTransport`; what is left here is the date, the values those two derive
 * into what the cards below display, and the layout that arranges them.
 */
function GroovePuzzleView({ groove }: { groove: Groove }) {
  // Today, resolved once on the client. The same day both selects the groove
  // and seeds the flavour options, and is what the header displays (R4, R5).
  const [today] = useState(() => new Date())
  const todayIso = isoDate(today)

  const {
    selectedRoot,
    selectedFlavour,
    attempts,
    solved,
    hydrated,
    selectRoot,
    selectFlavour,
    canCheck,
    check,
    answer,
    streak,
    history,
  } = usePuzzleSession(groove, today)

  const { soundingId, position, error: audioError, toggle } = useTransport()

  // Epic 3's three derivations. All pure functions of the attempt list, so
  // nothing about feedback, the nudge or the dots is stored or latched.
  const feedback = useMemo(
    () => selectFeedback(attempts, solved),
    [attempts, solved],
  )
  const showNudge = useMemo(
    () => shouldShowNudge(attempts, solved),
    [attempts, solved],
  )
  const dots = useMemo(() => dotStates(attempts, solved), [attempts, solved])

  // The groove behind each played day, resolved once per record. By id when the
  // record carries one — the path that survives the catalogue growing — and by
  // date only for records saved before the id existed. `null` is a real state:
  // the groove has left the catalogue, and the card's control says so (R10).
  const groovesByDate = useMemo(() => {
    const byDate = new Map<string, Groove | null>()
    for (const result of history) {
      byDate.set(result.date, resolveGrooveForResult(result, GROOVES))
    }
    return byDate
  }, [history])

  // Every past day, most recent first. The strip caps what it draws; the count
  // it shows is this full tally, not the number of cards.
  const archiveEntries = useMemo<ArchiveStripEntry[]>(
    () =>
      toArchiveEntries(history, todayIso).map((entry) => {
        const resolved = groovesByDate.get(entry.date)
        return {
          ...entry,
          grooveId: resolved?.id ?? null,
          grooveName: resolved?.name ?? null,
        }
      }),
    [history, todayIso, groovesByDate],
  )

  // The day's four flavour options: deterministic for the date, always
  // including the answer (R3, R4).
  const flavours = useMemo(
    () => flavourOptions(today, groove),
    [today, groove],
  )

  // The question every control on the page asks, today's two included: is the
  // sounding groove mine? (R5)
  const isPlaying = soundingId === groove.id

  // What a retry retries. The transport rolls its sounding id back on a
  // rejection, so re-toggling the same source starts it rather than stopping it.
  const lastSource = useRef<PlayableSource | null>(null)

  const toggleSource = useCallback(
    (source: PlayableSource) => {
      lastSource.current = source
      void toggle(source)
    },
    [toggle],
  )

  const handleToggle = useCallback(() => {
    toggleSource({
      id: groove.id,
      src: groove.audioSrc,
      loopSeconds: loopSecondsOf(groove),
    })
  }, [toggleSource, groove])

  /**
   * A card's control. The strip is presentational, so the puzzle turns the
   * entry back into the source it resolved for that day. An unresolvable day
   * never gets here — its control is disabled — but the guard keeps the handler
   * honest rather than relying on that.
   */
  const handleArchiveToggle = useCallback(
    (entry: ArchiveEntry) => {
      const played = groovesByDate.get(entry.date)
      if (!played) return
      toggleSource({
        id: played.id,
        src: played.audioSrc,
        loopSeconds: loopSecondsOf(played),
      })
    },
    [groovesByDate, toggleSource],
  )

  const handleRetry = useCallback(() => {
    toggleSource(
      lastSource.current ?? {
        id: groove.id,
        src: groove.audioSrc,
        loopSeconds: loopSecondsOf(groove),
      },
    )
  }, [toggleSource, groove])

  // No fresh-game frame may paint before the saved day is in the store: a day
  // already in progress would flash as untouched, and a solved day as unplayed.
  if (!hydrated) return <PuzzleLoading />

  return (
    <section aria-label="Daily Groove">
      <Stack gap="xl">
        <GrooveHeader date={today} streak={streak} />

        {audioError && (
          <div role="alert">
            <Card tone="inset">
              <Row gap="md" align="center" justify="between">
                <Text tone="muted">Couldn&apos;t play the groove.</Text>
                <button type="button" onClick={handleRetry}>
                  Retry
                </button>
              </Row>
            </Card>
          </div>
        )}

        {/* Two columns on wide screens, stacked below `md` (R15). Row makes the
            stacked case the default and the split the breakpoint override.
            `w-full` is what makes each card span the column once stacked: the
            Row aligns to `start`, which on a column axis is the horizontal one,
            so without it the cards shrink to their content. Above `md` the
            flex basis governs and the width goes back to auto. */}
        <Row gap="lg" align="start" collapseBelow="md">
          <div className="min-w-0 w-full flex-1 md:w-auto">
            <GrooveCard groove={groove}>
              <Stack gap="lg">
                <TransportPanel position={position} isPlaying={isPlaying} />
                {/* The control leads and the caption follows it, rather than
                    sitting beside it in a row (E2 R4, AC3). */}
                <Stack gap="sm">
                  {/* The domain word lives here, not in the design system:
                      a primitive that knows what a groove is has stopped
                      being reusable (see globals.test.ts I5). */}
                  <PlayControl
                    size="lg"
                    isPlaying={isPlaying}
                    onToggle={handleToggle}
                    text={{ play: 'Play the groove', stop: 'Stop' }}
                  />
                  <Text tone="muted" size="sm">
                    Play along. Find the note that feels like home.
                  </Text>
                </Stack>
              </Stack>
            </GrooveCard>
          </div>

          <div className="min-w-0 w-full flex-1 md:w-auto">
            <GuessCard
              roots={ROOTS}
              flavours={flavours}
              selectedRoot={selectedRoot}
              selectedFlavour={selectedFlavour}
              onSelectRoot={selectRoot}
              onSelectFlavour={selectFlavour}
              canCheck={canCheck}
              onCheck={check}
              solved={solved}
              feedback={feedback}
              showNudge={showNudge}
              dots={dots}
              answerRoot={answer.root}
            />
          </div>
        </Row>

        {/* The payoff, below both cards and only once the day is won (R6). */}
        {solved && (
          <SolvedPanel
            answer={answer}
            tries={attempts.length}
            streak={streak}
            chord={groove.chord}
            progression={groove.progression}
          />
        )}

        <ArchiveStrip
          entries={archiveEntries}
          soundingId={soundingId}
          onToggle={handleArchiveToggle}
        />
      </Stack>
    </section>
  )
}
