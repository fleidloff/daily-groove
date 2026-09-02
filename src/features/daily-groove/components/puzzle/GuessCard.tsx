'use client'

import { useState } from 'react'
import type { Flavour, Root } from '../../types'
import type { DotState, Feedback } from '../../lib/presentation/feedback'
import { AttemptDots } from './AttemptDots'
import { NudgeBox } from './NudgeBox'
import { ModeToggle } from './ModeToggle'
import { TapSoundsToggle } from './TapSoundsToggle'
import { Button } from '@/components/controls/Button'
import { Card } from '@/components/surfaces/Card'
import { ChipGroup } from '@/components/controls/ChipGroup'
import type { ChipOptionState } from '@/components/controls/ChipGroup'
import { Heading } from '@/components/typography/Heading'
import { Stack } from '@/components/layout/Stack'

const optionStatesFor = (
  options: readonly string[],
  ruledOut: readonly string[],
  confirmed: readonly string[],
): Record<string, ChipOptionState> => {
  const states: Record<string, ChipOptionState> = {}
  const locked = options.filter((option) => confirmed.includes(option))
  const out =
    locked.length > 0
      ? options.filter((option) => !locked.includes(option))
      : ruledOut
  for (const option of out) states[option] = { unavailable: true }
  return states
}

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
  coaching: Feedback
  showVerdict: boolean
  showNudge: boolean
  dots: DotState[]
  ruledOutRoots: Root[]
  ruledOutFlavours: Flavour[]
  confirmedRoots: Root[]
  confirmedFlavours: Flavour[]
  eliminated: number
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
  coaching,
  showVerdict,
  showNudge,
  dots,
  ruledOutRoots,
  ruledOutFlavours,
  confirmedRoots,
  confirmedFlavours,
  eliminated,
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
      : selectedRoot !== null
        ? 'Pick a mode'
        : selectedFlavour !== null
          ? 'Pick a root'
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
          onSelect={disarming((option: string) => onSelectRoot(option as Root))}
          onPress={disarming((option: string) => onHearRoot(option as Root))}
          disabled={over}
          columns={{ base: 4, wide: 6 }}
          adornment={tapSounds ? '♪' : undefined}
          optionStates={optionStatesFor(roots, ruledOutRoots, confirmedRoots)}
        />

        <ChipGroup
          label="Mode"
          name="flavour"
          options={flavours}
          value={selectedFlavour}
          onSelect={disarming((option: string) =>
            onSelectFlavour(option as Flavour),
          )}
          onPress={disarming((option: string) => onHearMode(option as Flavour))}
          disabled={over}
          columns={{ base: 2, wide: 4 }}
          adornment={tapSounds ? '♪' : undefined}
          optionStates={optionStatesFor(
            flavours,
            ruledOutFlavours,
            confirmedFlavours,
          )}
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

        {!over && (
          <NudgeBox
            feedback={showVerdict ? feedback : null}
            coaching={coaching}
            eliminated={showNudge ? eliminated : null}
          />
        )}

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
