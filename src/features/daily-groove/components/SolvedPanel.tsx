'use client'

import { Chip } from '@/components/Chip'
import { Heading } from '@/components/Heading'
import { LabelledColumn } from '@/components/LabelledColumn'
import { Panel, PanelColumns } from '@/components/Panel'
import { Row } from '@/components/Row'
import { Text } from '@/components/Text'
import { scaleNotes } from '../lib/notes'
import type { Answer } from '../types'

type SolvedPanelProps = {
  answer: Answer
  tries: number
  streak: number
  chord: string
  progression: string
}

/**
 * One try reads as a word, every other count as a numeral. Spelling out only
 * the singular is what keeps the line from reading "1 tries"; there is no case
 * for spelling out the rest.
 */
function triesLabel(tries: number): string {
  return tries === 1 ? 'one try' : `${tries} tries`
}

/** A row of read-only values, drawn for the inverted surface. */
function ValueChips({
  values,
  width,
}: {
  values: string[]
  width: 'auto' | 'fixed'
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {values.map((value) => (
        <Chip
          key={value}
          label={value}
          selected={false}
          disabled
          onSelect={() => {}}
          width={width}
          tone="inverted"
        />
      ))}
    </div>
  )
}

/**
 * The payoff: the day's answer, what it cost, and the music behind it.
 *
 * It is a live region rather than a dialog — solving is a result to be
 * announced, not an interruption to be acknowledged, so it takes `role="status"`
 * and then simply stays for the rest of the session.
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
  chord,
  progression,
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
              {`solved in ${triesLabel(tries)} · streak now ${streak}`}
            </Text>
          </Row>
        </div>
        <PanelColumns>
          <LabelledColumn label="The changes">
            <ValueChips values={[chord, progression]} width="auto" />
          </LabelledColumn>
          <LabelledColumn label="Notes to live in">
            <ValueChips values={notes} width="fixed" />
          </LabelledColumn>
        </PanelColumns>
      </Panel>
    </div>
  )
}
