'use client'

import type { Flavour, Root } from '../../types'
import type { DotState, Feedback } from '../../lib/presentation/feedback'
import { AttemptDots } from './AttemptDots'
import { FeedbackLine } from './FeedbackLine'
import { NudgeBox } from './NudgeBox'
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
  onSelectFlavour(f: Flavour): void
  canCheck: boolean
  onCheck(): void
  solved: boolean
  /** The line under the control, already selected by `lib/feedback`. */
  feedback: Feedback
  /** Whether the day's root has been revealed. Derived, never latched here. */
  showNudge: boolean
  /** One entry per attempt dot, already derived by `lib/feedback`. */
  dots: DotState[]
  /** The day's correct root — shown only by the nudge, once it is due. */
  answerRoot: Root
}

/**
 * The "What is it?" card: two single-select chip rows, one call to action, and
 * the feedback that follows a guess.
 *
 * Purely presentational — it holds no store reference, so `GroovePuzzle` stays
 * the only subscriber and this card can be driven straight from props in a
 * test. Every derived value (which dots are spent, what the line says, whether
 * the nudge is due) arrives as a prop rather than being recomputed here.
 *
 * The nudge is informational only. It renders below the control and touches
 * nothing else: no chip is selected, filtered or disabled on its account, so
 * the player still names the pair themselves (R6, R7).
 */
export function GuessCard({
  roots,
  flavours,
  selectedRoot,
  selectedFlavour,
  onSelectRoot,
  onSelectFlavour,
  canCheck,
  onCheck,
  solved,
  feedback,
  showNudge,
  dots,
  answerRoot,
}: GuessCardProps) {
  const bothChosen = selectedRoot !== null && selectedFlavour !== null

  // Solved is its own terminal state; otherwise the control either prompts for
  // the missing half or names the pair it is about to check (R7, R8). After a
  // wrong check it keeps naming the pair while disabled — the feedback line
  // below carries the explanation.
  const label = solved
    ? 'Solved'
    : bothChosen
      ? `Check ${selectedRoot} ${selectedFlavour}`
      : 'Pick a root and a flavour'

  const tone = solved ? 'solved' : canCheck ? 'ready' : 'idle'

  return (
    <Card>
      <Stack gap="lg">
        <Heading level={3} size="md">
          What is it?
        </Heading>

        <ChipGroup
          label="Root"
          name="root"
          options={roots}
          value={selectedRoot}
          onSelect={(option) => onSelectRoot(option as Root)}
          disabled={solved}
          columns={{ base: 4, wide: 6 }}
        />

        <ChipGroup
          label="Flavour"
          name="flavour"
          options={flavours}
          value={selectedFlavour}
          onSelect={(option) => onSelectFlavour(option)}
          disabled={solved}
          columns={{ base: 2, wide: 4 }}
        />

        {/*
          The dots read as progress on the control, not as decoration on the
          heading: a right-aligned row of dots alone, directly above the button
          they describe (R7, R7a).
        */}
        <div className="flex justify-end">
          <AttemptDots states={dots} />
        </div>

        <Button onPress={onCheck} disabled={!canCheck} tone={tone}>
          {label}
        </Button>

        <FeedbackLine feedback={feedback} />

        {showNudge && <NudgeBox root={answerRoot} />}
      </Stack>
    </Card>
  )
}
