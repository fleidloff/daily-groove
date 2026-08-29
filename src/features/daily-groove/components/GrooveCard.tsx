import type { ReactNode } from 'react'
import { Card } from '@/components/Card'
import { EyebrowLabel } from '@/components/EyebrowLabel'
import { Heading } from '@/components/Heading'
import { Row } from '@/components/Row'
import { Stack } from '@/components/Stack'
import type { Groove } from '../types'

type GrooveCardProps = {
  groove: Groove
  /** The transport panel and its controls, rendered below the header region. */
  children?: ReactNode
}

/**
 * Today's groove, in the raised cream card.
 *
 * The header region carries exactly two things: the groove's name and its
 * tempo. The canvas' meta line ("No. 214 · 4 bars · loops forever") is dropped
 * rather than filled, since none of it is backed by real data.
 */
export function GrooveCard({ groove, children }: GrooveCardProps) {
  return (
    <Card>
      <Stack gap="lg">
        <Row gap="md" align="start" justify="between">
          <Heading level={2} size="lg">
            {groove.name}
          </Heading>
          <div className="text-right">
            <Stack gap="xs">
              <span className="font-display text-[24px] leading-none text-text">
                {groove.bpm}
              </span>
              <EyebrowLabel>BPM</EyebrowLabel>
            </Stack>
          </div>
        </Row>
        {children}
      </Stack>
    </Card>
  )
}
