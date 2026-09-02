'use client'

import { useState } from 'react'
import type { Flavour, Root } from '../../types'
import type { DotState, Feedback } from '../../lib/presentation/feedback'
import { AttemptDots } from './AttemptDots'
import { FeedbackLine } from './FeedbackLine'
import { NudgeBox } from './NudgeBox'
import { ModeToggle } from './ModeToggle'
import { TapSoundsToggle } from './TapSoundsToggle'
import { Button } from '@/components/controls/Button'
import { Card } from '@/components/surfaces/Card'
import { ChipGroup } from '@/components/controls/ChipGroup'
import { Heading } from '@/components/typography/Heading'
import { Stack } from '@/components/layout/Stack'

type GuessCardProps = {
  roots: Root[]
  flavours: Flavour[]
  selectedRoot: Root | null
  selectedFlavour: Flavour | null
  onSelectRoot(r: Root): void
  onHearRoot(r: Root): void
  onSelectFlavour(f: Flavour): void
  onHearMode(f: Flavour): void
  canCheck: boolean
  onCheck(): void
  solved: boolean
  feedback: Feedback
  showNudge: boolean
  dots: DotState[]
  answerRoot: Root
  revealed: boolean
  showReveal: boolean
  onReveal(): void
  simple: boolean
  onToggleSimple(simple: boolean): void
  tapSounds: boolean
  onToggleTapSounds(on: boolean): void
}

export function GuessCard({
  roots,
  flavours,
  selectedRoot,
  selectedFlavour,
  onSelectRoot,
  onHearRoot,
  onSelectFlavour,
  onHearMode,
  canCheck,
  onCheck,
  solved,
  feedback,
  showNudge,
  dots,
  answerRoot,
  revealed,
  showReveal,
  onReveal,
  simple,
  onToggleSimple,
  tapSounds,
  onToggleTapSounds,
}: GuessCardProps) {
  const [armed, setArmed] = useState(false)

  const disarming =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => {
      setArmed(false)
      fn(...args)
    }

  const bothChosen = selectedRoot !== null && selectedFlavour !== null

  const over = solved || revealed

  const label = solved
    ? 'Solved'
    : bothChosen
      ? `Check ${selectedRoot} ${selectedFlavour}`
      : 'Pick a root and a mode'

  const tone = solved ? 'solved' : canCheck && !revealed ? 'ready' : 'idle'

  return (
    <Card>
      <Stack gap="lg">
        <Heading level={3} size="md">
          What is it?
        </Heading>

        <Stack gap="sm">
          <ModeToggle
            simple={simple}
            onChange={disarming(onToggleSimple)}
            disabled={over}
          />

          <TapSoundsToggle
            on={tapSounds}
            onChange={disarming(onToggleTapSounds)}
          />
        </Stack>

        <ChipGroup
          label="Root"
          name="root"
          options={roots}
          value={selectedRoot}
          onSelect={disarming((option: string) => {
            const root = option as Root
            onSelectRoot(root)
            onHearRoot(root)
          })}
          disabled={over}
          columns={{ base: 4, wide: 6 }}
          adornment={tapSounds ? '♪' : undefined}
        />

        <ChipGroup
          label="Mode"
          name="flavour"
          options={flavours}
          value={selectedFlavour}
          onSelect={disarming((option: Flavour) => {
            onSelectFlavour(option)
            onHearMode(option)
          })}
          disabled={over}
          columns={{ base: 2, wide: 4 }}
          adornment={tapSounds ? '♪' : undefined}
        />

        <div className="flex justify-end">
          <AttemptDots states={dots} />
        </div>

        <Button
          onPress={disarming(onCheck)}
          disabled={!canCheck || revealed}
          tone={tone}
          size="lg"
        >
          {label}
        </Button>

        <FeedbackLine feedback={feedback} />

        {showNudge && <NudgeBox root={answerRoot} />}

        {showReveal && !revealed && (
          <Button
            onPress={armed ? onReveal : () => setArmed(true)}
            disabled={false}
            tone="idle"
          >
            {armed
              ? 'Yes — end the day and show the answer'
              : 'Give up and show the answer'}
          </Button>
        )}
      </Stack>
    </Card>
  )
}
