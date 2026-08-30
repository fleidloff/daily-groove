'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import { useStore } from 'zustand'
import type { Groove } from '../types'
import {
  createDailyGrooveStore,
  type DailyGrooveState,
} from '../hooks/useDailyGrooveStore'
import { toArchiveEntries, type ArchiveEntry } from '../lib/archive'
import { resolveGrooveForResult } from '../lib/resolveGroove'
import { createPageTransport, type PlayableSource } from '../lib/transport'
import { dotStates, selectFeedback, shouldShowNudge } from '../lib/feedback'
import { answerOf, flavourOptions, ROOTS } from '../lib/music'
import { isoDate, selectGrooveForDate } from '../lib/selectGroove'
import { GROOVES } from '../lib/grooves.generated'
import { useProgress } from '../hooks/useProgress'
import { ArchiveStrip, type ArchiveStripEntry } from './ArchiveStrip'
import { GrooveCard } from './GrooveCard'
import { GrooveHeader } from './GrooveHeader'
import { GuessCard } from './GuessCard'
import { SolvedPanel } from './SolvedPanel'
import { TransportPanel } from './TransportPanel'
import { Card } from '@/components/Card'
import { PlayControl } from '@/components/PlayControl'
import { Row } from '@/components/Row'
import { Stack } from '@/components/Stack'
import { Text } from '@/components/Text'

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
 * Renders a puzzle for a concrete groove. Split out so the Zustand store and
 * audio player are only created once a groove is known.
 *
 * This is the feature's only store subscriber: it reads the day's state, derives
 * everything Epics 3-5 display through `lib/`, and hands plain values and
 * handlers to the presentational cards below it.
 */
function GroovePuzzleView({ groove }: { groove: Groove }) {
  // Today, resolved once on the client. The same day both selects the groove
  // and seeds the flavour options, and is what the header displays (R4, R5).
  const [today] = useState(() => new Date())
  const todayIso = isoDate(today)
  const { streak, history, todayResult, loaded, recordAttempt } =
    useProgress(todayIso)

  // The answer is the groove's own `root` and `flavour` fields — the values
  // the generator wrote next to the audio, not a parse of its `scale` string.
  const answer = useMemo(() => answerOf(groove), [groove])

  // One store instance per puzzle, created once. Held in state (not a ref) so it
  // is stable across renders without reading a ref during render. It is created
  // *empty*: the saved day arrives through `hydrate` below, so nothing here
  // reads localStorage synchronously and the async `ResultStore` seam survives.
  const [store] = useState(() => createDailyGrooveStore(answer))

  // Restoration, exactly once. `todayResult` changes again on every write, and
  // re-hydrating then would overwrite a selection the player has since made —
  // so the latch is a ref, not a dependency.
  const [hydrated, setHydrated] = useState(false)
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (!loaded || hydratedRef.current) return
    hydratedRef.current = true
    store.getState().hydrate(todayResult)
    // Gates the first game frame on the store read: see the `hydrated` check
    // below, which keeps the loading state up until this has run.
    setHydrated(true)
  }, [loaded, todayResult, store])

  const selectedRoot = useStore(store, (s: DailyGrooveState) => s.selectedRoot)
  const selectedFlavour = useStore(
    store,
    (s: DailyGrooveState) => s.selectedFlavour,
  )
  const attempts = useStore(store, (s: DailyGrooveState) => s.attempts)
  const solved = useStore(store, (s: DailyGrooveState) => s.solved)
  const selectRoot = useStore(store, (s: DailyGrooveState) => s.selectRoot)
  const selectFlavour = useStore(store, (s: DailyGrooveState) => s.selectFlavour)
  const check = useStore(store, (s: DailyGrooveState) => s.check)

  // `canCheck` derives from state rather than being state, so it is recomputed
  // on every render the subscribed slices trigger.
  const canCheck = store.getState().canCheck()

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

  // The page's single owner of playback, held in state so it is stable across
  // renders. It builds its player on the first press, never during render.
  // Exclusivity is structural: one transport cannot sound two grooves, so no
  // control has to know about any other (R3, R4).
  const [transport] = useState(() => createPageTransport())
  const [audioError, setAudioError] = useState(false)

  useEffect(() => () => transport.dispose(), [transport])

  // Playback state is read straight off the transport rather than mirrored into
  // React state, so the progress bar follows the real position frame by frame.
  // One subscription covers both: the transport notifies on start, on stop and
  // throughout playback.
  const soundingId = useSyncExternalStore(
    transport.subscribe,
    transport.getSoundingId,
    () => null,
  )
  const position = useSyncExternalStore(
    transport.subscribe,
    transport.getPosition,
    () => 0,
  )

  // The question every control on the page asks, today's two included: is the
  // sounding groove mine? (R5)
  const isPlaying = soundingId === groove.id

  // What a retry retries. The transport rolls its sounding id back on a
  // rejection, so re-toggling the same source starts it rather than stopping it.
  const lastSource = useRef<PlayableSource | null>(null)

  const toggleSource = useCallback(
    async (source: PlayableSource) => {
      lastSource.current = source
      setAudioError(false)
      try {
        await transport.toggle(source)
      } catch {
        setAudioError(true)
      }
    },
    [transport],
  )

  const handleToggle = useCallback(() => {
    void toggleSource({ id: groove.id, src: groove.audioSrc })
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
      void toggleSource({ id: played.id, src: played.audioSrc })
    },
    [groovesByDate, toggleSource],
  )

  const handleRetry = useCallback(() => {
    void toggleSource(
      lastSource.current ?? { id: groove.id, src: groove.audioSrc },
    )
  }, [toggleSource, groove])

  /**
   * Check the chosen pair, then persist the day. The record is written after
   * every check rather than only on a solve, so a reload mid-game comes back to
   * the attempts already spent (R2). The attempt list is read back off the
   * store, which is the only place that accumulates it.
   */
  const handleCheck = useCallback(() => {
    const before = store.getState().attempts.length
    check()
    const { attempts: after, solved: nowSolved } = store.getState()
    // A rejected check (same pair, or an already-solved day) writes nothing.
    if (after.length === before) return
    // The record remembers which groove the day played, so the row can replay
    // it later even after the catalogue has grown (E5 R7).
    void recordAttempt({
      answer,
      attempts: after,
      solved: nowSolved,
      grooveId: groove.id,
    })
  }, [store, check, answer, recordAttempt, groove])

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
              onCheck={handleCheck}
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
