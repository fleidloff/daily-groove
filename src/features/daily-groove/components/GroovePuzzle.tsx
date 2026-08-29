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
import { createAudioPlayer, type AudioPlayer } from '../lib/audio'
import { toArchiveEntries } from '../lib/archive'
import { dotStates, selectFeedback, shouldShowNudge } from '../lib/feedback'
import { flavourOptions, parseScale, ROOTS } from '../lib/music'
import { isoDate, selectGrooveForDate } from '../lib/selectGroove'
import { GROOVES } from '../lib/seed'
import { useProgress } from '../hooks/useProgress'
import { ArchiveStrip } from './ArchiveStrip'
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
 * A lazily-constructed handle on the loop player.
 *
 * The `AudioPlayer` itself is only built on the first press — a user gesture on
 * the client — so no `Audio` element exists during render or server prerender.
 * React still needs a stable `subscribe` from the first render, so this shim
 * owns the listener set and forwards the player's notifications into it once the
 * player exists.
 */
type Transport = {
  subscribe: (fn: () => void) => () => void
  getIsPlaying: () => boolean
  getPosition: () => number
  toggle: () => Promise<void>
  play: () => Promise<void>
  dispose: () => void
}

function createTransport(src: string): Transport {
  const listeners = new Set<() => void>()
  let player: AudioPlayer | null = null
  let unsubscribe: (() => void) | null = null

  const notify = () => {
    for (const listener of Array.from(listeners)) listener()
  }

  function ensurePlayer(): AudioPlayer {
    if (!player) {
      player = createAudioPlayer(src)
      unsubscribe = player.subscribe(notify)
    }
    return player
  }

  return {
    subscribe(fn) {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    },
    getIsPlaying: () => (player ? player.isPlaying() : false),
    getPosition: () => (player ? player.getPosition() : 0),
    async toggle() {
      const current = ensurePlayer()
      // Pausing holds the position; the next play resumes rather than restarts.
      if (current.isPlaying()) {
        current.pause()
        return
      }
      await current.play()
    },
    async play() {
      await ensurePlayer().play()
    },
    dispose() {
      unsubscribe?.()
      unsubscribe = null
      player?.dispose()
      player = null
      listeners.clear()
    },
  }
}

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

  // The answer is derived from the groove's own `scale` — one source of truth.
  const answer = useMemo(() => parseScale(groove.scale), [groove.scale])

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

  // Every past day, most recent first. The strip caps what it draws; the count
  // it shows is this full tally, not the number of cards.
  const archiveEntries = useMemo(
    () => toArchiveEntries(history, todayIso),
    [history, todayIso],
  )

  // The day's four flavour options: deterministic for the date, always
  // including the answer (R3, R4).
  const flavours = useMemo(
    () => flavourOptions(today, groove),
    [today, groove],
  )

  // The player is built on first press, never during render.
  const [transport] = useState(() => createTransport(groove.audioSrc))
  const [audioError, setAudioError] = useState(false)

  useEffect(() => () => transport.dispose(), [transport])

  // Playback state is read straight off the player rather than mirrored into
  // React state, so the progress bar follows the real position frame by frame.
  const isPlaying = useSyncExternalStore(
    transport.subscribe,
    transport.getIsPlaying,
    () => false,
  )
  const position = useSyncExternalStore(
    transport.subscribe,
    transport.getPosition,
    () => 0,
  )

  const handleToggle = useCallback(async () => {
    setAudioError(false)
    try {
      await transport.toggle()
    } catch {
      setAudioError(true)
    }
  }, [transport])

  const handleRetry = useCallback(async () => {
    setAudioError(false)
    try {
      await transport.play()
    } catch {
      setAudioError(true)
    }
  }, [transport])

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
    void recordAttempt({ answer, attempts: after, solved: nowSolved })
  }, [store, check, answer, recordAttempt])

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
            stacked case the default and the split the breakpoint override. */}
        <Row gap="lg" align="start" collapseBelow="md">
          <div className="min-w-0 flex-1">
            <GrooveCard groove={groove}>
              <Stack gap="lg">
                <TransportPanel position={position} isPlaying={isPlaying} />
                <Row gap="md" align="center">
                  <PlayControl isPlaying={isPlaying} onToggle={handleToggle} />
                  <Text tone="muted" size="sm">
                    Play along. Find the note that feels like home.
                  </Text>
                </Row>
              </Stack>
            </GrooveCard>
          </div>

          <div className="min-w-0 flex-1">
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
          total={archiveEntries.length}
        />
      </Stack>
    </section>
  )
}
