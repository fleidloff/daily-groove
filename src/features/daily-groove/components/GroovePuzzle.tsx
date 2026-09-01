'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { Groove } from '../types'
import type { PlayableSource } from '../lib/audio/transport'
import {
  dotStates,
  selectFeedback,
  shouldOfferReveal,
  shouldShowNudge,
} from '../lib/presentation/feedback'
import {
  flavourOptions,
  ROOTS,
  loopSecondsOf,
  simpleRootOptions,
} from '../lib/theory/music'
import { FAMILIES } from '../lib/theory/families'
import { barChords } from '../lib/theory/changes'
import { metaLine } from '../lib/presentation/date'
import { selectGrooveForDate } from '../lib/puzzle/selectGroove'
import { GROOVES } from '../data/grooves.generated'
import { NOTES } from '../data/notes.generated'
import {
  createLocalStore,
  createReadOnlyStore,
} from '../lib/persistence/storage'
import { usePuzzleSession } from '../hooks/usePuzzleSession'
import { useReferenceNote } from '../hooks/useReferenceNote'
import { useSimpleMode } from '../hooks/useSimpleMode'
import { useTransport } from '../hooks/useTransport'
import { GrooveCard } from './puzzle/GrooveCard'
import { PlayTodayLink } from './puzzle/PlayTodayLink'
import { SharedGrooveNotice } from './puzzle/SharedGrooveNotice'
import { GrooveHeader } from './header/GrooveHeader'
import { ShareGroove } from './header/ShareGroove'
import { HowToPlay } from './intro/HowToPlay'
import { GuessCard } from './puzzle/GuessCard'
import { SolvedPanel } from './solved/SolvedPanel'
import { TransportPanel } from './puzzle/TransportPanel'
import { Card } from '@/components/surfaces/Card'
import { PlayControl } from '@/components/controls/PlayControl'
import { Row } from '@/components/layout/Row'
import { Stack } from '@/components/layout/Stack'
import { Text } from '@/components/typography/Text'
import { APP_NAME } from '@/lib/branding'

/**
 * Which entry point this puzzle is being played from. `'daily'` is the puzzle at
 * `/`: it reads and writes the day's record. `'shared'` is a groove opened by
 * its own link: it reads the same saved results — the streak on a shared page is
 * the player's real one — and writes nothing at all (F12 E1 R18, R19, R20).
 *
 * It is a mode rather than a `persist` boolean because it is the *entry point*
 * the page is being viewed through, and Epic 3 hangs the shared framing off the
 * same value.
 */
export type PuzzleMode = 'daily' | 'shared'

type GroovePuzzleProps = {
  groove?: Groove
  /** 'daily' persists the day; 'shared' persists nothing. Defaults to 'daily'. */
  mode?: PuzzleMode
}

// The feature's landmark name, held once so the loading branch and the loaded
// branch cannot disagree about what the page is (F8 E1 R8, AC6).
const REGION_LABEL = APP_NAME

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
    <section aria-label={REGION_LABEL}>
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
export function GroovePuzzle({ groove, mode = 'daily' }: GroovePuzzleProps) {
  const resolved = useSyncExternalStore<Groove | undefined>(
    subscribeNoop,
    () => groove ?? selectGrooveForDate(new Date(), GROOVES),
    () => groove,
  )

  if (!resolved) return <PuzzleLoading />

  return <GroovePuzzleView groove={resolved} mode={mode} />
}

/**
 * Renders a puzzle for a concrete groove. Split out so the day's session and
 * its audio transport are only created once a groove is known.
 *
 * Composition only. The day's state lives in `usePuzzleSession` and playback in
 * `useTransport`; what is left here is the date, the values those two derive
 * into what the cards below display, and the layout that arranges them.
 */
function GroovePuzzleView({
  groove,
  mode,
}: {
  groove: Groove
  mode: PuzzleMode
}) {
  /**
   * Whether this is a groove somebody shared rather than today's puzzle.
   *
   * Two visible things hang off it and nothing else: the notice above the cards,
   * and the words "shared groove" where the card's meta line writes the date.
   * The header, the streak pill, the how-to-play box and both cards are the
   * daily page's, unchanged — keeping them identical is the requirement
   * (F12 E3 R4, R7a, R7b, AC3).
   */
  const shared = mode === 'shared'

  /**
   * The persistence this play is written through — or, on a shared groove, is
   * not written through (F12 E1 R18, R21).
   *
   * A decorator over the one `ResultStore` seam rather than a flag carried into
   * the session: reads pass through, so the streak the header shows is the
   * player's real one, and the write path is simply gone, so no future save site
   * has to remember that a shared mode exists.
   *
   * `undefined` on the daily page, which is what leaves `usePuzzleSession` on
   * the module singleton it has always used. Built once in state so the session
   * is never handed a new store mid-day — that would reset the day, exactly as
   * recreating the game store would.
   */
  const [resultStore] = useState(() =>
    shared ? createReadOnlyStore(createLocalStore()) : undefined,
  )

  // Today, resolved once on the client. The same day both selects the groove
  // and seeds the flavour options, and is what the groove card displays beside
  // the tempo (R4, R5; F8 E1 R13).
  const [today] = useState(() => new Date())

  // The player's own preference, not the day's: it is read from its own store
  // and survives both a reload and a new day (E5 R7). Everything it changes is
  // below — two option sets and one comparison. The day itself never sees it.
  const { simple, setSimple } = useSimpleMode()

  // The row's second voice. It is built here, beside the transport, because
  // both belong to the page rather than to a card — but the two share nothing
  // except the `AudioContext` that `lib/audio/context.ts` owns, so a tap
  // cannot move the groove and stopping the groove cannot cut a note (R6, R13).
  // The whole chromatic set is handed over whatever mode is on: simple mode's
  // six are a subset, so switching costs no fetch (R7, R18).
  const { playRoot, warm } = useReferenceNote(NOTES)

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
    revealed,
    reveal,
    answer,
    streak,
    newOrLapsed,
  } = usePuzzleSession(groove, today, simple, resultStore)

  // Whether the how-to-play box is on screen. `null` means "follow the rule";
  // the box's close control and the header's question mark are the only two
  // things that set it, and nothing about it is persisted (F8 E3 R6, R7, R8).
  // Session state in the page rather than a preference: it says nothing about
  // who the player is, so it stays out of `preferences.ts`.
  const [helpOverride, setHelpOverride] = useState<boolean | null>(null)
  const showHelp = helpOverride ?? newOrLapsed

  const handleShowHelp = useCallback(() => setHelpOverride(true), [])
  const handleCloseHelp = useCallback(() => setHelpOverride(false), [])

  // What the page plays: today's groove, its musical loop length, and where
  // inside its own file the music starts. The head delay is per-groove data,
  // measured from that mp3 at mint time — no constant is shared across the
  // catalogue (R4). Memoised on the groove so the transport, which captures
  // its source at construction, is handed a stable value.
  const source = useMemo<PlayableSource>(
    () => ({
      src: groove.audioSrc,
      loopSeconds: loopSecondsOf(groove),
      headDelaySeconds: groove.headDelaySeconds,
    }),
    [groove],
  )

  // How many passes of the four-bar figure this groove's file is. The panel
  // draws four bars whatever the file's length, so it needs this to turn a
  // position over the whole loop into a position within a pass (F9 E1 R9a).
  // Derived here rather than in the panel: the panel is never handed a groove,
  // and rounding keeps an entry with no `loopBars` — where the file is exactly
  // its figure — at 1.
  const passes = useMemo(
    () => Math.max(1, Math.round((groove.loopBars ?? groove.bars) / groove.bars)),
    [groove],
  )

  // One groove on the page, so the transport's own boolean is the answer — no
  // control has to ask whether the sounding groove is the one it belongs to.
  const {
    isPlaying,
    loading,
    position,
    error: audioError,
    toggle,
  } = useTransport(source)

  // Epic 3's derivations, and feature-7's fourth beside them. All pure
  // functions of the attempt list and the day's outcome, so nothing about
  // feedback, the nudge, the dots or the way out is stored or latched (R12).
  const feedback = useMemo(
    () => selectFeedback(attempts, solved),
    [attempts, solved],
  )
  const showNudge = useMemo(
    () => shouldShowNudge(attempts, solved),
    [attempts, solved],
  )
  const dots = useMemo(() => dotStates(attempts, solved), [attempts, solved])
  const showReveal = useMemo(
    () => shouldOfferReveal(attempts, solved, revealed),
    [attempts, solved, revealed],
  )

  // The two rows the card offers, and the only thing simple mode changes about
  // the page. Both narrowings are deterministic for the date and both keep the
  // answer reachable: the six roots are drawn around it (E5 R2, R3), and every
  // mode belongs to one of the two families (E5 R4, R5). Switching swaps the
  // sets and nothing else — not the groove, not the answer, not the attempts.
  const roots = useMemo(
    () => (simple ? simpleRootOptions(today, answer) : ROOTS),
    [simple, today, answer],
  )

  // The day's four flavour options: deterministic for the date, always
  // including the answer (R3, R4).
  const flavours = useMemo(
    () => (simple ? FAMILIES : flavourOptions(today, groove)),
    [simple, today, groove],
  )

  /**
   * A selection the current mode no longer offers reads as no selection.
   *
   * Switching modes narrows both rows, and the store keeps whatever was chosen
   * before — deliberately, so toggling back restores the day rather than losing
   * it (R8). But a pair the player cannot see must not be checkable: without
   * this, the control would read "Check B Aeolian" in simple mode, sit enabled,
   * and spend an attempt on a chip that is not on screen.
   *
   * Derived, not pruned. Clearing the store on a switch would throw the choice
   * away and make toggling back lossy; hiding it leaves it to come back intact.
   */
  const offeredRoot = selectedRoot !== null && roots.includes(selectedRoot)
    ? selectedRoot
    : null
  const offeredFlavour =
    selectedFlavour !== null && flavours.includes(selectedFlavour)
      ? selectedFlavour
      : null
  const canCheckOffered =
    canCheck && offeredRoot !== null && offeredFlavour !== null

  const handleToggle = useCallback(() => {
    void toggle()
  }, [toggle])

  /**
   * Fetch and decode the twelve reference notes in the background, once, after
   * the groove the player pressed for has finished loading (R18, R19).
   *
   * The gate is the transport's own `loading`, not a timer: warming twelve
   * files while the groove is still fetching would put thirteen requests and
   * thirteen decodes in front of the one sound the player actually asked for.
   * Waiting for `isPlaying` with `loading` clear means the groove is audible
   * before anything else is asked for.
   *
   * A ref, not state: warming is a side effect with no rendered consequence,
   * and re-rendering to record that it happened would be a paint for nothing.
   * Warming is an optimisation and never a precondition — a tap that lands
   * first fetches its own note on demand (R19a).
   */
  const warmed = useRef(false)
  useEffect(() => {
    if (warmed.current) return
    if (!isPlaying || loading) return
    warmed.current = true
    warm()
  }, [isPlaying, loading, warm])

  // No fresh-game frame may paint before the saved day is in the store: a day
  // already in progress would flash as untouched, and a solved day as unplayed.
  if (!hydrated) return <PuzzleLoading />

  /*
    One element, rendered in one of two places: inside the row's second column
    while the day is in play, and as a sibling below the row once it has ended
    (F15 E5 R1, R3). Hoisted rather than written twice so its twenty props exist
    once and cannot drift between the two positions — which is what makes AC4's
    "the same props it had inside the row" true by construction rather than by
    inspection. The two references are mutually exclusive, so React never sees
    both.
  */
  const guessCard = (
    <GuessCard
      roots={roots}
      flavours={flavours}
      selectedRoot={offeredRoot}
      selectedFlavour={offeredFlavour}
      onSelectRoot={selectRoot}
      onHearRoot={playRoot}
      onSelectFlavour={selectFlavour}
      canCheck={canCheckOffered}
      onCheck={check}
      solved={solved}
      feedback={feedback}
      showNudge={showNudge}
      dots={dots}
      answerRoot={answer.root}
      revealed={revealed}
      showReveal={showReveal}
      onReveal={reveal}
      simple={simple}
      onToggleSimple={setSimple}
    />
  )

  return (
    <section aria-label={REGION_LABEL}>
      <Stack gap="xl">
        {/* No question mark while the box is up: a control asking for what
            is already on screen is noise (E3 R10). */}
        {/* The share control is a page-level action, so it goes in the
            header and stays there for the whole life of the page — before the
            first guess, between guesses, after a solve and after a reveal
            (F12 E2 R1, R2). It is passed outside every branch that depends on
            the day's outcome, and in both modes, so a groove that arrived by
            link can be passed on exactly as today's can (F12 E2 R4). */}
        <GrooveHeader
          streak={streak}
          onShowHelp={showHelp ? null : handleShowHelp}
          share={<ShareGroove groove={groove} />}
        />

        {/* Under the header and above the two cards: it precedes the game it
            explains and never covers it (F8 E3 R5). It cannot reach the first
            painted frame either — the view is still on `PuzzleLoading` until
            the day's record has been read (F8 E3 R11). */}
        {showHelp && <HowToPlay onClose={handleCloseHelp} />}

        {audioError && (
          <div role="alert">
            <Card tone="inset">
              <Row gap="md" align="center" justify="between">
                <Text tone="muted">Couldn&apos;t play the groove.</Text>
                <button type="button" onClick={handleToggle}>
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
        {/* Directly above the two-column row, the same placement `HowToPlay`
            uses: it precedes the game it frames and never covers it. It says
            what this page is and that the streak is safe, and it carries the
            one way back to today (F12 E3 R1, R2, R3, R5). */}
        {shared && <SharedGrooveNotice />}

        {/*
          No `align`, so the columns take flexbox's own default and stretch to
          the taller of the two (F15 E5 R1a). Two boxes side by side with
          different heights read as one unfinished; equal height is what makes
          them a pair. The tops still line up — that is what puts the box's
          first line level with the play control — because stretching aligns
          both edges rather than only the top.
        */}
        <Row gap="lg" collapseBelow="md">
          <div className="min-w-0 w-full flex-1 md:w-auto grid">
            {/* The card is handed a finished meta line rather than a date, so
                the two pages differ in data and the card branches on nothing.
                A shared groove belongs to no day, and today's date here would
                be the exact confusion the words replace (F12 E3 R1a, AC11). */}
            <GrooveCard
              groove={groove}
              meta={metaLine(
                groove,
                shared ? null : today,
                solved || revealed ? answer : null,
              )}
            >
              <Stack gap="lg">
                {/* Zero unless something is sounding: the panel cannot draw
                    a position for audio that is not playing, so nothing is
                    held or left decaying after a stop (R5, AC6). */}
                {/* The changes over the bars, but only once the day has
                    ended: the progression names the root and the mode, so
                    before then the card is exactly what it was (E3 R1, R2,
                    R3). `solved || revealed` is the payoff panel's own
                    condition below — the same terminal state, not a second
                    name for it. */}
                <TransportPanel
                  position={isPlaying ? position : 0}
                  isPlaying={isPlaying}
                  passes={passes}
                  chords={
                    solved || revealed ? barChords(groove.progression) : null
                  }
                />
                {/* The control leads and the caption follows it, rather than
                    sitting beside it in a row (E2 R4, AC3). */}
                <Stack gap="sm">
                  {/* The domain word lives here, not in the design system:
                      a primitive that knows what a groove is has stopped
                      being reusable (see globals.test.ts I5). */}
                  <PlayControl
                    isPlaying={isPlaying}
                    onToggle={handleToggle}
                    busy={loading}
                    text={{
                      play: 'Play the groove',
                      stop: 'Stop',
                      loading: 'Loading…',
                    }}
                  />
                  {/* The line that sets the task is where the answer belongs
                      (F10 E2 R1a, R5, AC6). `♪` on the root chips marks
                      where; this sentence is what names the behaviour, and it
                      offers your own instrument first rather than only. Its
                      tone, its size and its place under the control are
                      feature-4 E2 R4's and are unchanged. */}
                  <Text tone="muted" size="sm">
                    Find the note that feels like home — Play along with
                    your instrument or tap a root to hear it.
                  </Text>
                </Stack>
              </Stack>
            </GrooveCard>
          </div>

          <div className="min-w-0 w-full flex-1 md:w-auto grid">
            {/*
              The payoff takes the guess card's column once the day has ended
              either way, so the lesson is read level with the transport rather
              than two cards below it (F15 E5 R1, R1a). A revealed day sees the
              same panel: the solution is what the player asked for, and the
              panel itself drops the claim of a win (E3 R10, R10a).

              Document order is the placement — no `order`, no absolute or fixed
              positioning, so a screen reader and a sighted reader meet the
              day's payoff at the same point (F15 E5 R7).

              The conditional is deliberately confined to *this* column. The row
              keeps exactly two static children, and nothing between the row and
              `GrooveCard` is conditional: a wrapper or a varying `key` above the
              groove card would change its position in the tree and remount the
              transport that is sounding through it (F15 E5 R1b). Re-parenting
              the guess card below does re-create its subtree, and that is the
              accepted cost — it holds no state of its own, so it re-renders
              identically from the session's props (F15 E5 R3a).
            */}
            {solved || revealed ? (
              <div
                // The box fills the column so it ends level with the groove
                // card beside it (F15 E5 R1c). A grid stretches its auto-sized
                // row to the container, which is what does that.
                //
                // The explicit `1fr auto` pair is only correct when the link is
                // there: declaring two rows applies the gap between them
                // whether or not the second holds anything, which left 24px of
                // empty panel under the box on the daily page.
                className={
                  shared ? 'grid grid-rows-[1fr_auto] gap-6' : 'grid'
                }
              >
                <SolvedPanel
                  answer={answer}
                  progression={groove.progression}
                  progressionDegrees={groove.progressionDegrees}
                  attempts={attempts}
                  revealed={revealed}
                />
                {/*
                  And on a shared groove only, the next move: today's puzzle
                  (F12 E3 R5a, R5b, R5c). Still a sibling after the panel rather
                  than a branch inside it — the panel is the day's payoff on both
                  pages, and it is not the place that knows what a shared groove
                  is — and now in the same column as the panel, directly beneath
                  it, so the way onward stays beside the answer it belongs to
                  rather than landing below the finished guess card (F12 E3 R5a,
                  AC14; F15 E5 R1).

                  The condition reduces to `shared` alone: the branch it sits in
                  has already established the terminal state, so it is no longer
                  spelled twice.
                */}
                {shared && <PlayTodayLink />}
              </div>
            ) : (
              guessCard
            )}
          </div>
        </Row>

        {/*
          The record of how the day was played, once it has ended: the same card
          with the same props, one place lower (F15 E5 R3, AC4).

          It keeps the width it had as the row's second column rather than
          spreading to the full page. Beside the groove card it was half the
          width, and a finished record that doubles in size on the way down
          reads as a promotion — the opposite of what moving it below is for.
          Below the row's collapse point it is full width, which is what it
          already was inside the row.

          The width is a second `Row` with the same `gap` and the same
          `collapseBelow`, holding the card in an identical column and an empty
          one beside it, rather than a `w-[calc(50%-…)]` naming half of `gap-7`
          by hand. Both rows then take their column width from one place: change
          `gap` above and this follows, where a hand-written calc would quietly
          disagree by fourteen pixels. The empty column is the price, and it is
          `aria-hidden` because there is nothing in it to read.
        */}
        {(solved || revealed) && (
          <Row gap="lg" collapseBelow="md">
            <div className="min-w-0 w-full flex-1 md:w-auto grid">{guessCard}</div>
            <div aria-hidden="true" className="hidden flex-1 md:block" />
          </Row>
        )}
      </Stack>
    </section>
  )
}
