'use client'

import { useState } from 'react'
import type { Flavour, Root } from '../../types'
import type { DotState, Feedback } from '../../lib/presentation/feedback'
import { AttemptDots } from './AttemptDots'
import { FeedbackLine } from './FeedbackLine'
import { NudgeBox } from './NudgeBox'
import { ModeToggle } from './ModeToggle'
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
  /**
   * The day ended without being solved. Terminal like `solved`: the chips and
   * the check control stop accepting input, and nothing is offered to give up
   * on any more.
   */
  revealed: boolean
  /** Whether to offer the way out. Derived by `lib/feedback`, never latched. */
  showReveal: boolean
  /** Ends the day. Only ever called by the *second* press (R6a). */
  onReveal(): void
  /**
   * Whether the puzzle is narrowed. The card does not narrow anything itself —
   * `roots` and `flavours` already hold whatever the mode offers — it only
   * shows the switch in the right position (R1).
   */
  simple: boolean
  /** Asked for the mode the player wants. Never locked by the day (R8a). */
  onToggleSimple(simple: boolean): void
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
 *
 * The one exception to "every derived value arrives as a prop" is `armed`,
 * below. Whether the give-up control has been pressed once is transient state
 * for one card: it must not survive a reload, nothing else reads it, and a
 * reload landing unarmed is the safe direction. So it stays here, and is
 * neither lifted nor persisted.
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
  revealed,
  showReveal,
  onReveal,
  simple,
  onToggleSimple,
}: GuessCardProps) {
  const [armed, setArmed] = useState(false)

  // Doing anything else with the card is the way back out of an armed reveal:
  // no cancel to find, and no timer that could disarm behind the player's back
  // (R6b). Every interactive handler goes through here.
  const disarming =
    <A extends unknown[]>(fn: (...args: A) => void) =>
    (...args: A) => {
      setArmed(false)
      fn(...args)
    }

  const bothChosen = selectedRoot !== null && selectedFlavour !== null

  // Both terminal states lock the card. `solved` keeps its own wording; a
  // revealed day simply stops accepting input (R7).
  const over = solved || revealed

  // Solved is its own terminal state; otherwise the control either prompts for
  // the missing half or names the pair it is about to check (R7, R8). After a
  // wrong check it keeps naming the pair while disabled — the feedback line
  // below carries the explanation.
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

        {/*
          The switch sits above both rows, so the shape of the question is
          settled before the question is asked (R1). It is deliberately outside
          the `over` lock below: a finished day still lets the player change how
          tomorrow is asked, and switching is not an attempt (R8a).
        */}
        <ModeToggle simple={simple} onChange={disarming(onToggleSimple)} />

        <ChipGroup
          label="Root"
          name="root"
          options={roots}
          value={selectedRoot}
          onSelect={disarming((option: string) => onSelectRoot(option as Root))}
          disabled={over}
          columns={{ base: 4, wide: 6 }}
        />

        {/*
          The row holds modes, so it says "Mode" (R1). `name` stays `flavour`:
          it is a DOM grouping key for the chip elements, never read by a
          player, and the props, the store and the manifest still speak of a
          groove's flavour.
        */}
        <ChipGroup
          label="Mode"
          name="flavour"
          options={flavours}
          value={selectedFlavour}
          onSelect={disarming((option: Flavour) => onSelectFlavour(option))}
          disabled={over}
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

        <Button
          onPress={disarming(onCheck)}
          disabled={!canCheck || revealed}
          tone={tone}
        >
          {label}
        </Button>

        <FeedbackLine feedback={feedback} />

        {showNudge && <NudgeBox root={answerRoot} />}

        {/*
          Giving up is two presses (R6a). The first only changes this label —
          the day stays in progress, the chips stay live, and a guess checked
          while armed is scored normally. The second is the one that ends it.
        */}
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
