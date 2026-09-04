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
import { flavourPool, loopSecondsOf } from '@/lib/theory/music'
import type { Family } from '@/lib/theory/families'
import { simpleLickMode } from '@/lib/theory/simpleModes'
import { barChords } from '@/lib/theory/changes'
import { writtenChord } from '@/lib/theory/written'
import { metaLine } from '../lib/presentation'
import { selectGrooveForDate } from '../lib/puzzle/selectGroove'
import { GROOVES, HEARD_IN } from '../data/grooves.generated'
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
import {
  PuzzleSessionProvider,
  type PuzzleSessionValue,
} from '../state/PuzzleSessionContext'
import { useModeLick } from '../hooks/useModeLick'
import { usePuzzleSession } from '../hooks/usePuzzleSession'
import { useReferenceNote } from '../hooks/useReferenceNote'
import { useSimpleMode } from '../hooks/useSimpleMode'
import { useTapSounds } from '../hooks/useTapSounds'
import { useInstrumentKey } from '../hooks/useInstrumentKey'
import { useNextGroove } from '../hooks/useNextGroove'
import { useTransport } from '../hooks/useTransport'
import { GrooveCard } from './puzzle/GrooveCard'
import { PlayTodayLink } from './puzzle/PlayTodayLink'
import { SharedGrooveNotice } from './puzzle/SharedGrooveNotice'
import { GrooveHeader } from './header/GrooveHeader'
import { ShareGroove } from './header/ShareGroove'
import { TransposeSelect } from './header/TransposeSelect'
import { HowToPlay } from './intro/HowToPlay'
import { GuessCard } from './puzzle/GuessCard'
import { SolvedPanel } from './solved/SolvedPanel'
import { TransportPanel } from './puzzle/TransportPanel'
import { Card } from '@/components/surfaces/Card'
import { PlayControl } from '@/components/controls/PlayControl'
import { Row } from '@/components/layout/Row'
import { Stack } from '@/components/layout/Stack'
import { Text } from '@/components/typography/Text'
import { branding, puzzle } from '@/lib/snippets'

export type PuzzleMode = 'daily' | 'shared'

type GroovePuzzleProps = {
  groove?: Groove
  mode?: PuzzleMode
}

const REGION_LABEL = branding.appName

const subscribeNoop = () => () => {}

const FLAVOUR_POOL = flavourPool(GROOVES)

function PuzzleLoading() {
  return (
    <section aria-label={REGION_LABEL}>
      <Text tone="muted">{puzzle.loading}</Text>
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

  const { simple, setSimple, loaded: modeLoaded } = useSimpleMode({
    results: resultStore,
  })

  const { tapSounds, setTapSounds } = useTapSounds()

  const { instrumentKey, setInstrumentKey, loaded: instrumentKeyLoaded } = useInstrumentKey()

  const nextGroove = useNextGroove(today)

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

  const session = usePuzzleSession(groove, today, simple, resultStore)

  const { attempts, solved, hydrated, revealed, answer, streak, newOrLapsed } =
    session

  const sessionValue = useMemo<PuzzleSessionValue>(
    () => ({
      groove,
      today,
      session,
      simple,
      setSimple,
      tapSounds,
      setTapSounds,
      instrumentKey,
      setInstrumentKey,
    }),
    [
      groove,
      today,
      session,
      simple,
      setSimple,
      tapSounds,
      setTapSounds,
      instrumentKey,
      setInstrumentKey,
    ],
  )

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

  if (!hydrated || !modeLoaded || !instrumentKeyLoaded) return <PuzzleLoading />

  const guessCard = (
    <GuessCard onHearRoot={hearRoot} onHearMode={handleHearMode} />
  )

  return (
    <PuzzleSessionProvider value={sessionValue}>
      <section aria-label={REGION_LABEL}>
        <Stack gap="xl">
        <GrooveHeader
          streak={streak}
          onShowHelp={showHelp ? null : handleShowHelp}
          share={<ShareGroove groove={groove} />}
          transpose={<TransposeSelect instrumentKey={instrumentKey} onChange={setInstrumentKey} />}
        />

        {showHelp && <HowToPlay onClose={handleCloseHelp} />}

        {audioError && (
          <div role="alert">
            <Card tone="inset">
              <Row gap="md" align="center" justify="between">
                <Text tone="muted">{puzzle.audioError}</Text>
                <button type="button" onClick={handleToggle}>
                  {puzzle.audioRetry}
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
                instrumentKey,
              )}
              nextGroove={!shared && (solved || revealed) ? nextGroove : undefined}
            >
              <Stack gap="lg">
                <TransportPanel
                  position={isPlaying ? position : 0}
                  isPlaying={isPlaying}
                  passes={passes}
                  chords={
                    solved || revealed
                      ? barChords(groove.progression).map((chord) =>
                          writtenChord(chord, instrumentKey),
                        )
                      : null
                  }
                />
                <PlayControl
                  isPlaying={isPlaying}
                  onToggle={handleToggle}
                  busy={loading}
                  text={puzzle.playText}
                  name={puzzle.playName}
                />
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
                  heardIn={HEARD_IN[groove.scale]}
                  instrumentKey={instrumentKey}
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
    </PuzzleSessionProvider>
  )
}
