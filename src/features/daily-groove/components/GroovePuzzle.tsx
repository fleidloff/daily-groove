'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import type { Flavour, Groove, Root } from '../types'
import type { PlayableSource } from '../lib/audio/transport'
import {
  dotStates,
  selectFeedback,
  shouldOfferReveal,
  shouldShowNudge,
} from '../lib/presentation/feedback'
import {
  flavourOptions,
  flavourPool,
  ROOTS,
  loopSecondsOf,
  simpleRootOptions,
} from '../lib/theory/music'
import { FAMILIES, type Family } from '../lib/theory/families'
import { simpleLickMode } from '../lib/theory/simpleModes'
import { barChords } from '../lib/theory/changes'
import { confirmedHalves } from '../lib/presentation/confirmed'
import { ruledOut } from '../lib/presentation/ruledOut'
import { metaLine } from '../lib/presentation/date'
import { selectGrooveForDate } from '../lib/puzzle/selectGroove'
import { GROOVES } from '../data/grooves.generated'
import { NOTES, PITCHES } from '../data/notes.generated'
import {
  REFERENCE_FADE_SECONDS,
  REFERENCE_LEVEL,
} from '../lib/audio/level'
import { referenceOutput } from '../lib/audio/output'
import {
  createLocalStore,
  createReadOnlyStore,
} from '../lib/persistence/storage'
import { useModeLick } from '../hooks/useModeLick'
import { usePuzzleSession } from '../hooks/usePuzzleSession'
import { useReferenceNote } from '../hooks/useReferenceNote'
import { useSimpleMode } from '../hooks/useSimpleMode'
import { useTapSounds } from '../hooks/useTapSounds'
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

export type PuzzleMode = 'daily' | 'shared'

type GroovePuzzleProps = {
  groove?: Groove
  mode?: PuzzleMode
}

const REGION_LABEL = APP_NAME

const subscribeNoop = () => () => {}

const FLAVOUR_POOL = flavourPool(GROOVES)

const CAPTION_SOUNDS_ON =
  'Find the note that feels like home — Play along with your instrument, or tap a root or a mode to hear it.'

const CAPTION_SOUNDS_OFF =
  'Find the note that feels like home — Play along with your instrument.'

function PuzzleLoading() {
  return (
    <section aria-label={REGION_LABEL}>
      <Text tone="muted">Loading today&apos;s groove…</Text>
    </section>
  )
}

export function GroovePuzzle({ groove, mode = 'daily' }: GroovePuzzleProps) {
  const resolved = useSyncExternalStore<Groove | undefined>(
    subscribeNoop,
    () => groove ?? selectGrooveForDate(new Date(), GROOVES),
    () => groove,
  )

  if (!resolved) return <PuzzleLoading />

  return <GroovePuzzleView groove={resolved} mode={mode} />
}

function GroovePuzzleView({
  groove,
  mode,
}: {
  groove: Groove
  mode: PuzzleMode
}) {
  const shared = mode === 'shared'

  const [resultStore] = useState(() =>
    shared ? createReadOnlyStore(createLocalStore()) : undefined,
  )

  const [today] = useState(() => new Date())

  const { simple, setSimple } = useSimpleMode()

  const { tapSounds, setTapSounds } = useTapSounds()

  const source = useMemo<PlayableSource>(
    () => ({
      src: groove.audioSrc,
      loopSeconds: loopSecondsOf(groove),
      headDelaySeconds: groove.headDelaySeconds,
    }),
    [groove],
  )

  const {
    isPlaying,
    loading,
    position,
    error: audioError,
    toggle,
    clock,
  } = useTransport(source, groove.bpm)

  const { playRoot, warm } = useReferenceNote(NOTES, { clock })

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

  const { playMode, warm: warmLicks } = useModeLick({
    pitches: PITCHES,
    root: answer.root,
    bpm: groove.bpm,
    clock,
    level: REFERENCE_LEVEL,
    fadeSeconds: REFERENCE_FADE_SECONDS,
    output: referenceOutput(),
  })

  const [helpOverride, setHelpOverride] = useState<boolean | null>(null)
  const showHelp = helpOverride ?? newOrLapsed

  const handleShowHelp = useCallback(() => setHelpOverride(true), [])
  const handleCloseHelp = useCallback(() => setHelpOverride(false), [])

  const passes = useMemo(
    () => Math.max(1, Math.round((groove.loopBars ?? groove.bars) / groove.bars)),
    [groove],
  )

  const feedback = useMemo(
    () => selectFeedback(attempts, solved),
    [attempts, solved],
  )
  const dots = useMemo(() => dotStates(attempts, solved), [attempts, solved])
  const showReveal = useMemo(
    () => shouldOfferReveal(attempts, solved, revealed),
    [attempts, solved, revealed],
  )

  const roots = useMemo(
    () => (simple ? simpleRootOptions(today, answer) : ROOTS),
    [simple, today, answer],
  )

  const flavours = useMemo(
    () => (simple ? FAMILIES : flavourOptions(today, groove)),
    [simple, today, groove],
  )

  const narrowing = useMemo(
    () => ruledOut({ attempts, answer, roots, date: today }),
    [attempts, answer, roots, today],
  )

  const showNudge = useMemo(
    () => shouldShowNudge(narrowing.eliminatedCount, solved),
    [narrowing, solved],
  )

  const confirmed = useMemo(() => confirmedHalves(attempts), [attempts])

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

  const hearRoot = useCallback(
    (root: Root) => {
      if (!tapSounds) return
      playRoot(root)
    },
    [tapSounds, playRoot],
  )

  const handleHearMode = useCallback(
    (option: Flavour) => {
      let mode: Flavour | null = option
      if (simple) {
        try {
          mode = simpleLickMode({
            family: option as Family,
            answer,
            pool: FLAVOUR_POOL,
            date: today,
          })
        } catch {
          mode = null
        }
      }
      if (!tapSounds) return
      if (mode !== null) playMode(mode)
    },
    [simple, answer, today, playMode, tapSounds],
  )

  const warmed = useRef(false)
  useEffect(() => {
    if (warmed.current) return
    if (!isPlaying || loading) return
    if (!tapSounds) return
    warmed.current = true
    warm()
    warmLicks()
  }, [isPlaying, loading, tapSounds, warm, warmLicks])

  if (!hydrated) return <PuzzleLoading />

  const guessCard = (
    <GuessCard
      roots={roots}
      flavours={flavours}
      selectedRoot={offeredRoot}
      selectedFlavour={offeredFlavour}
      onSelectRoot={selectRoot}
      onHearRoot={hearRoot}
      onSelectFlavour={selectFlavour}
      onHearMode={handleHearMode}
      canCheck={canCheckOffered}
      onCheck={check}
      solved={solved}
      feedback={feedback}
      showNudge={showNudge}
      dots={dots}
      ruledOutRoots={narrowing.roots}
      ruledOutFlavours={narrowing.flavours}
      eliminated={narrowing.eliminatedCount}
      confirmedRoots={confirmed.roots}
      confirmedFlavours={confirmed.flavours}
      revealed={revealed}
      showReveal={showReveal}
      onReveal={reveal}
      simple={simple}
      onToggleSimple={setSimple}
      tapSounds={tapSounds}
      onToggleTapSounds={setTapSounds}
    />
  )

  return (
    <section aria-label={REGION_LABEL}>
      <Stack gap="xl">
        <GrooveHeader
          streak={streak}
          onShowHelp={showHelp ? null : handleShowHelp}
          share={<ShareGroove groove={groove} />}
        />

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

        {shared && <SharedGrooveNotice />}

        <Row gap="lg" collapseBelow="md">
          <div className="min-w-0 w-full flex-1 md:w-auto grid">
            <GrooveCard
              groove={groove}
              meta={metaLine(
                groove,
                shared ? null : today,
                solved || revealed ? answer : null,
              )}
            >
              <Stack gap="lg">
                <TransportPanel
                  position={isPlaying ? position : 0}
                  isPlaying={isPlaying}
                  passes={passes}
                  chords={
                    solved || revealed ? barChords(groove.progression) : null
                  }
                />
                <Stack gap="sm">
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
                  <Text tone="muted" size="sm">
                    {tapSounds ? CAPTION_SOUNDS_ON : CAPTION_SOUNDS_OFF}
                  </Text>
                </Stack>
              </Stack>
            </GrooveCard>
          </div>

          <div className="min-w-0 w-full flex-1 md:w-auto grid">
            {solved || revealed ? (
              <div
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
                {shared && <PlayTodayLink />}
              </div>
            ) : (
              guessCard
            )}
          </div>
        </Row>

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
