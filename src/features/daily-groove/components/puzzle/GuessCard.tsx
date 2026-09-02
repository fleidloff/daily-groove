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
  /**
   * Sound the root that was just tapped. Called on every root tap, including a
   * re-tap of the chip already selected (F10 E1 R1, AC2), and never for a mode
   * chip — the mode row stays silent.
   *
   * Best effort by contract: it returns nothing and must never throw, because
   * `onSelectRoot` has already run by the time it is called and no audio
   * failure may undo the selection (F10 E1 R9, R10).
   */
  onHearRoot(r: Root): void
  onSelectFlavour(f: Flavour): void
  /**
   * Sound the mode that was just tapped. Called on every mode tap, including a
   * re-tap of the chip already selected (F16 E1 R1, AC2).
   *
   * Best effort by contract: it returns nothing and must never throw, because
   * `onSelectFlavour` has already run by the time it is called and no audio
   * failure may undo the selection (F16 E1 R19).
   */
  onHearMode(f: Flavour): void
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
  /**
   * Whether tapping a chip sounds. Drives both rows' `♪` and nothing else
   * here — the gate itself is in `GroovePuzzle`, where the handlers are built,
   * so a tap with the sounds off fetches and decodes nothing (F16 E2 R11).
   *
   * One flag for both rows: the root row's mark and the mode row's read the
   * same prop, and the mode handler passes through the same gate, so there is
   * no second notion of "the chips are audible" to keep in step.
   */
  tapSounds: boolean
  /**
   * Asked for the state the player wants. Never locked by the day
   * (F16 E2 R5a) — see the call site below for why this one does not settle
   * when the mode toggle above it does.
   */
  onToggleTapSounds(on: boolean): void
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
          The card's two preferences, in one stack above both rows (F16 E2 R1,
          AC1). They are the same control with different words — both render
          `@/components/controls/Switch` — so they read as a pair rather than
          as two treatments that happen to be adjacent (F16 E2 R14).

          Both flips go through `disarming`: changing a preference is doing
          something else with the card, which is the documented way back out of
          an armed give-up (F7 E3 R6b), and neither is an attempt.
        */}
        <Stack gap="sm">
          {/*
            The mode switch sits above both rows, so the shape of the question
            is settled before the question is asked (R1). It stays live for the
            whole playable day — narrowing the row mid-puzzle is the point, and
            switching is not an attempt (R8a) — and it settles with the chips
            once the day is over: the same `over`, so there is one notion of
            finished on this card (F11 E4 R1, R2).
          */}
          <ModeToggle
            simple={simple}
            onChange={disarming(onToggleSimple)}
            disabled={over}
          />

          {/*
            And it is handed no `over`, which is the surprising part of the two
            lines above being different. The mode is a record of how the day
            was played, so it settles with the card; the tap sounds are a
            durable setting, and this card is the only place they can be
            changed — so the switch stays live for the whole day, solved or
            given up (F16 E2 R5a, AC11b). `TapSoundsToggle` declares no
            `disabled` prop at all, so that is structural rather than a choice
            made here.
          */}
          <TapSoundsToggle
            on={tapSounds}
            onChange={disarming(onToggleTapSounds)}
          />
        </Stack>

        {/*
          One gesture, two things: the root row reports the choice and asks for
          the note (F10 E1 R1, R2, AC1). Selection goes first — it is the half
          that is allowed to fail loudly — and the second call is deliberately
          unguarded, so a re-tap of the chip already selected sounds it again
          (AC2). Both sit inside `disarming`, so a root tap still cancels an
          armed give-up exactly as it did before.

          The `♪` is the promise that goes with it (F10 E2 R1, R2, AC1). The
          chip only knows it has an adornment; that this one means "this chip
          sounds" is decided here, which is what keeps the primitive free of
          the domain. The mode row wears the same mark, because mode chips
          sound too now (F16 E1 R23). It is deliberately outside the `over`
          lock: a locked row is still an audible one (R3, AC4).

          It is inside the `tapSounds` condition, though. A row that cannot
          sound must not promise that it will, so with the sounds off the mark
          goes — from both rows, on the one flag (F16 E2 R12, AC11). `Chip`
          renders the span only for a truthy string, so `undefined` removes the
          mark and changes nothing else: the chips keep their classes, their
          accessible names and their offer.
        */}
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

        {/*
          The row holds modes, so it says "Mode" (R1). `name` stays `flavour`:
          it is a DOM grouping key for the chip elements, never read by a
          player, and the props, the store and the manifest still speak of a
          groove's flavour.

          One gesture, two things, exactly as the root row above does it: the
          row reports the choice and asks for the lick (F16 E1 R1, R2, AC1).
          Selection goes first — it is the half that is allowed to fail loudly
          — and the second call is deliberately unguarded, so a re-tap of the
          chip already selected sounds it again (AC2). Both sit inside
          `disarming`, so a mode tap still cancels an armed give-up.

          Hearing is not guessing: nothing here spends an attempt, fills a dot
          or scores anything (R3, AC3).

          The `♪` is the promise that goes with it (R23, R24, AC16). The chip
          only knows it has an adornment; that this one means "this chip
          sounds" is decided here, which is what keeps the primitive free of
          the domain — and the chip renders it `aria-hidden`, so a chip's
          accessible name stays its label alone. It is deliberately outside the
          `over` lock: a locked row is still an audible one. It is inside the
          `tapSounds` condition, which is the seam the two epics agreed on:
          Epic 1 marked the row, Epic 2 routed both rows' marks through the one
          flag (F16 E2 R12, AC11).
        */}
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

        {/*
          The dots read as progress on the control, not as decoration on the
          heading: a right-aligned row of dots alone, directly above the button
          they describe (R7, R7a).
        */}
        <div className="flex justify-end">
          <AttemptDots states={dots} />
        </div>

        {/*
          The call to action, at the play control's size (F16 E2 R15, AC13).
          `lg` is the size `PlayControl` already asks for rather than a third
          one: the two moves the card offers are equals, and the button that
          ends the puzzle should not read as an afterthought beside the one
          that starts it. Nothing came down to meet it — the give-up control
          below keeps the default, because it is not the call to action.

          The longest label this can show is `Check E♭ Phrygian dominant`, 26
          characters, which fits on one line at 360px and is asserted as the
          budget in the test beside this file (R16, AC14).
        */}
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
