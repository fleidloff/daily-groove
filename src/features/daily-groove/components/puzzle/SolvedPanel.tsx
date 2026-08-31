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
import { scaleNotes } from '../../lib/theory/notes'
import { staffNotes } from '../../lib/theory/staff'
import type { Answer } from '../../types'

type SolvedPanelProps = {
  answer: Answer
  tries: number
  streak: number
  /**
   * The day's changes as the generator writes them, en-dash separated. The
   * panel draws them as bars; the tonic is bar one, so it is not passed — or
   * shown — a second time (R6).
   */
  progression: string
  /**
   * The day was given up on rather than solved. The panel shows the same
   * solution either way — that is what the player asked to see — but drops the
   * claim of a win: no attempt count, no streak (R10, R10a).
   */
  revealed: boolean
}

/**
 * One try reads as a word, every other count as a numeral. Spelling out only
 * the singular is what keeps the line from reading "1 tries"; there is no case
 * for spelling out the rest.
 */
function triesLabel(tries: number): string {
  return tries === 1 ? 'one try' : `${tries} tries`
}

/**
 * The payoff: the day's answer, what it cost, and the music behind it.
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
  tries,
  streak,
  progression,
  revealed,
}: SolvedPanelProps) {
  const notes = scaleNotes(answer)

  return (
    <div role="status">
      <Panel>
        <div className="mb-7">
          <Row gap="md" align="baseline" collapseBelow="sm">
            <Heading level={2} size="lg" tone="inverted">
              {`${answer.root} ${answer.flavour}`}
            </Heading>
            <Text size="sm" tone="inverted-muted">
              {revealed
                ? 'given up · the day is over'
                : `solved in ${triesLabel(tries)} · streak now ${streak}`}
            </Text>
          </Row>
        </div>
        <Stack gap="xl">
          <LabelledColumn label="The changes">
            <LeadSheet chords={barChords(progression)} />
          </LabelledColumn>
          <LabelledColumn label="Notes to live in">
            <ScaleStaff notes={staffNotes(notes)} label={notes.join(' ')} />
          </LabelledColumn>
        </Stack>
      </Panel>
    </div>
  )
}
