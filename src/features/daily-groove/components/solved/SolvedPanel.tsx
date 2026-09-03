'use client'

import { Heading } from '@/components/typography/Heading'
import { LabelledColumn } from '@/components/layout/LabelledColumn'
import { Panel } from '@/components/surfaces/Panel'
import { Row } from '@/components/layout/Row'
import { Stack } from '@/components/layout/Stack'
import { Text } from '@/components/typography/Text'
import { LeadSheet } from './LeadSheet'
import { ScaleStaff } from './ScaleStaff'
import { barChords } from '@/lib/theory/changes'
import { barNumerals } from '@/lib/theory/numerals'
import { characterOf } from '@/lib/theory/character'
import { solved } from '@/lib/snippets'
import { scaleDegrees } from '@/lib/theory/degrees'
import { scaleNotes } from '@/lib/theory/notes'
import { selectNearMiss } from '../../lib/presentation/nearMiss'
import { staffLabel } from '../../lib/presentation/staffLabel'
import { staffNotes } from '@/lib/theory/staff'
import type { Answer, Attempt } from '../../types'

type SolvedPanelProps = {
  answer: Answer
  progression: string
  progressionDegrees?: number[]
  attempts: Attempt[]
  revealed: boolean
}

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
  const nearMiss = selectNearMiss(attempts, answer, revealed)

  return (
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
                  {solved.modeLine({ flavour: answer.flavour })}
                </Text>
              )}
            </Row>
            {nearMiss !== undefined && (
              <Text size="sm" tone="inverted-muted">
                {nearMiss}
              </Text>
            )}
          </Stack>
        </div>
        <Stack gap="xl">
          <LabelledColumn label={solved.changes}>
            <LeadSheet
              chords={barChords(progression)}
              numerals={barNumerals(answer.flavour, progressionDegrees)}
            />
          </LabelledColumn>
          <LabelledColumn label={solved.notesToLiveIn}>
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
