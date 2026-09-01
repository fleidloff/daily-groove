'use client'

import { Heading } from '@/components/typography/Heading'
import { LabelledColumn } from '@/components/layout/LabelledColumn'
import { Panel } from '@/components/surfaces/Panel'
import { Row } from '@/components/layout/Row'
import { Stack } from '@/components/layout/Stack'
import { Text } from '@/components/typography/Text'
import { LeadSheet } from './LeadSheet'
import { ScaleStaff } from './ScaleStaff'
import { barChords } from '../../lib/theory/changes'
import { barNumerals } from '../../lib/theory/numerals'
import { characterOf } from '../../lib/theory/character'
import { scaleDegrees } from '../../lib/theory/degrees'
import { scaleNotes } from '../../lib/theory/notes'
import { selectNearMiss } from '../../lib/presentation/nearMiss'
import { staffLabel } from '../../lib/presentation/staffLabel'
import { staffNotes } from '../../lib/theory/staff'
import type { Answer, Attempt } from '../../types'

type SolvedPanelProps = {
  answer: Answer
  /**
   * The day's changes as the generator writes them, en-dash separated. The
   * panel draws them as bars; the tonic is bar one, so it is not passed — or
   * shown — a second time (R6).
   */
  progression: string
  /**
   * The same changes as scale-degree indices — one per chord, in the same order,
   * indexing `intervalsFor(answer.flavour)` rather than counting diatonic
   * degrees. Optional, and absent rather than empty on a groove minted before
   * the field existed: a numeral is less load-bearing than a bar, so where the
   * degrees are missing the numerals are missing and the changes are not
   * (F15 E3 R4a, R8).
   */
  progressionDegrees?: number[]
  /**
   * The day's scored guesses, in the order they were checked. The panel reads
   * the last one that missed and says how far it was from the answer (F15 E4
   * R1, R2); it counts nothing — the score left the box with F15 E1 R5.
   */
  attempts: Attempt[]
  /**
   * The day was given up on rather than solved. The panel shows the same
   * solution either way — that is what the player asked to see, and what makes
   * a mode sound like itself does not depend on whether it was found (F15 E1
   * R7).
   *
   * With the score gone this drives exactly one thing: the phrase
   * `given up · the day is over`. If that phrase ever moves, the prop leaves
   * `SolvedPanel` with it (F15 E1 R7a) — that decision is not this epic's.
   */
  revealed: boolean
}

/**
 * The payoff: the day's answer, what makes it sound that way, and the music
 * behind it.
 *
 * The line beside the answer is the lesson, not the score (F15 E1 R1, R5). The
 * attempt count and the streak used to hold that slot; the dot row already
 * reads `Solved` and `StreakBadge` already shows the run, so the box spends its
 * one line of prose on what the player came for instead. A mode the table has
 * no line for renders the box without the line rather than throwing (R3a).
 *
 * It is a live region rather than a dialog — solving is a result to be
 * announced, not an interruption to be acknowledged, so it takes `role="status"`
 * and then simply stays for the rest of the session.
 *
 * Both halves are drawings, and a staff wants the panel's whole width, so the
 * two labelled groups stack rather than sharing a two-column grid: the lead
 * sheet at full width, the staff beneath it (R1c).
 *
 * Ink comes from the `inverted` tones, which resolve to the `on-accent`
 * token — it flips with the palette, so the panel stays legible in both.
 * Overriding it at the one place that inverts the surface keeps the design
 * system free of a panel-specific variant.
 */
export function SolvedPanel({
  answer,
  progression,
  progressionDegrees,
  attempts,
  revealed,
}: SolvedPanelProps) {
  const notes = scaleNotes(answer)
  const degrees = scaleDegrees(answer)
  const character = characterOf(answer.flavour)
  // No branch on `revealed`: a day given up on gets the same sentence, because
  // how far the guess was does not depend on how the day ended (F15 E4 R11).
  const nearMiss = selectNearMiss(attempts, answer)

  return (
    // A one-cell grid, so the panel fills whatever height this wrapper is given
    // rather than sitting content-height inside it. The wrapper exists only to
    // carry `role="status"`, and a stretched wrapper with an unstretched panel
    // inside it is why the box came up short of the groove card beside it
    // (F15 E5 R1c).
    <div role="status" className="grid">
      <Panel>
        <div className="mb-7">
          <Stack gap="sm">
            <Row gap="md" align="baseline" collapseBelow="sm">
              <Heading level={2} size="lg" tone="inverted">
                {`${answer.root} ${answer.flavour}`}
              </Heading>
              {character !== undefined && (
                <Text size="sm" tone="inverted-muted">
                  {character.line}
                </Text>
              )}
              {revealed && (
                <Text size="sm" tone="inverted-muted">
                  given up · the day is over
                </Text>
              )}
            </Row>
            {/*
              Rendered only where there is something to say: an unconditional
              `Text` leaves an empty paragraph and a stray gap under the answer
              on every day solved first time (F15 E4 R6).
            */}
            {nearMiss !== undefined && (
              <Text size="sm" tone="inverted-muted">
                {nearMiss}
              </Text>
            )}
          </Stack>
        </div>
        <Stack gap="xl">
          <LabelledColumn label="The changes">
            <LeadSheet
              chords={barChords(progression)}
              numerals={barNumerals(answer.flavour, progressionDegrees)}
            />
          </LabelledColumn>
          <LabelledColumn label="Notes to live in">
            <ScaleStaff
              notes={staffNotes(notes)}
              degrees={degrees}
              label={staffLabel(degrees, notes)}
            />
          </LabelledColumn>
        </Stack>
      </Panel>
    </div>
  )
}
