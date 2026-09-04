'use client'

import { useState } from 'react'
import type { Flavour, Root } from '../../types'
import { guessCardView, type OptionView } from '../../lib/presentation'
import { usePuzzleSessionContext } from '../../state/PuzzleSessionContext'
import { NudgeBox } from './NudgeBox'
import { ModeToggle } from './ModeToggle'
import { TapSoundsToggle } from './TapSoundsToggle'
import { Button } from '@/components/controls/Button'
import { Card } from '@/components/surfaces/Card'
import { ChipGroup } from '@/components/controls/ChipGroup'
import type { ChipOptionState } from '@/components/controls/ChipGroup'
import { Heading } from '@/components/typography/Heading'
import { Stack } from '@/components/layout/Stack'
import { puzzle } from '@/lib/snippets'

const chipStates = (options: readonly OptionView[]) => {
  const states: Record<string, ChipOptionState> = {}
  for (const option of options) {
    if (option.state === 'out') states[option.value] = { unavailable: true }
  }
  return states
}

const chipLabels = (options: readonly OptionView[]) =>
  Object.fromEntries(options.map((option) => [option.value, option.label]))

type GuessCardProps = {
  onHearRoot(r: Root): void
  onHearMode(f: Flavour): void
}

export function GuessCard({ onHearRoot, onHearMode }: GuessCardProps) {
  const {
    groove,
    today,
    session,
    simple,
    setSimple,
    tapSounds,
    setTapSounds,
    written,
  } = usePuzzleSessionContext()

  const view = guessCardView({
    groove,
    date: today,
    answer: session.answer,
    attempts: session.attempts,
    selectedRoot: session.selectedRoot,
    selectedFlavour: session.selectedFlavour,
    solved: session.solved,
    revealed: session.revealed,
    canCheck: session.canCheck,
    simple,
    tapSounds,
    written,
  })

  const [armed, setArmed] = useState(false)

  const disarming =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => {
      setArmed(false)
      fn(...args)
    }

  return (
    <Card>
      <Stack gap="lg">
        <Heading level={3} size="md">
          {puzzle.guessTitle}
        </Heading>

        <Stack gap="sm">
          <ModeToggle
            simple={simple}
            onChange={disarming(setSimple)}
            disabled={view.over}
          />

          <TapSoundsToggle on={tapSounds} onChange={disarming(setTapSounds)} />
        </Stack>

        <ChipGroup
          label={puzzle.rootGroup}
          name="root"
          options={view.roots.map((option) => option.value)}
          value={view.selectedRoot}
          onSelect={disarming((option: string) =>
            session.selectRoot(option as Root),
          )}
          onPress={disarming((option: string) => onHearRoot(option as Root))}
          disabled={false}
          settled={view.over}
          columns={{ base: 4, wide: 6 }}
          adornment={tapSounds ? '♪' : undefined}
          optionStates={chipStates(view.roots)}
          optionLabels={chipLabels(view.roots)}
        />

        <ChipGroup
          label={puzzle.modeGroup}
          name="flavour"
          options={view.flavours.map((option) => option.value)}
          value={view.selectedFlavour}
          onSelect={disarming((option: string) =>
            session.selectFlavour(option as Flavour),
          )}
          onPress={disarming((option: string) => onHearMode(option as Flavour))}
          disabled={false}
          settled={view.over}
          columns={{ base: 2, wide: 4 }}
          adornment={tapSounds ? '♪' : undefined}
          optionStates={chipStates(view.flavours)}
        />

        <Button
          onPress={disarming(session.check)}
          disabled={!view.check.enabled}
          tone={view.check.tone}
          size="lg"
        >
          {view.check.label}
        </Button>

        {view.hint.show && (
          <NudgeBox
            feedback={view.hint.feedback}
            coaching={view.hint.coaching}
            eliminated={view.hint.eliminated}
          />
        )}

        {view.giveUp && (
          <Button
            onPress={armed ? session.reveal : () => setArmed(true)}
            disabled={false}
            tone="idle"
          >
            {armed ? puzzle.giveUpArmed : puzzle.giveUp}
          </Button>
        )}
      </Stack>
    </Card>
  )
}
