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
import type { Written } from '@/lib/theory/transpose'
import { writtenAnswer, writtenChord } from '@/lib/theory/written'
import type { Answer, Attempt, HeardIn } from '../../types'

type SolvedPanelProps = {
  answer: Answer
  progression: string
  progressionDegrees?: number[]
  attempts: Attempt[]
  revealed: boolean
  heardIn?: HeardIn
  written: Written
}

export function SolvedPanel({
  answer,
  progression,
  progressionDegrees,
  attempts,
  revealed,
  heardIn,
  written,
}: SolvedPanelProps) {
  const shown = writtenAnswer(answer, written)
  const notes = scaleNotes(shown)
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
                {`${shown.root} ${shown.flavour}`}
              </Heading>
              {character !== undefined && (
                <Text size="sm" tone="inverted-muted">
                  {solved.modeLine({ flavour: answer.flavour })}
                </Text>
              )}
            </Row>
            {written !== 'C' && (
              <Text size="sm" tone="inverted-muted">
                {solved.concertPitch(answer)}
              </Text>
            )}
            {nearMiss !== undefined && (
              <Text size="sm" tone="inverted-muted">
                {nearMiss}
              </Text>
            )}
            {heardIn !== undefined && (
              <Text size="sm" tone="inverted-muted">
                {solved.heardIn(heardIn)}
              </Text>
            )}
          </Stack>
        </div>
        <Stack gap="xl">
          <LabelledColumn label={solved.changes}>
            <LeadSheet
              chords={barChords(progression).map((chord) =>
                writtenChord(chord, written),
              )}
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
