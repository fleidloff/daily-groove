import type { ReactNode } from 'react'
import { Card } from '@/components/surfaces/Card'
import { Heading } from '@/components/typography/Heading'
import { Text } from '@/components/typography/Text'
import { Stack } from '@/components/layout/Stack'
import { dateLine } from '../../lib/presentation/date'
import type { Groove } from '../../types'

type GrooveCardProps = {
  groove: Groove
  /**
   * The day being shown, repeated from the page header beside the tempo.
   * Passed in rather than read from the clock so the route owns "today" — the
   * same day that selects the groove — and so this card is testable without
   * fake timers, matching `GrooveHeader`.
   */
  date: Date
  /** The transport panel and its controls, rendered below the header region. */
  children?: ReactNode
}

/**
 * Today's groove, in the raised cream card.
 *
 * The header region carries the groove's name and, as a caption beneath it, the
 * tempo. The tempo sits in its own node rather than inside the heading, so the
 * heading's accessible name stays the groove's name alone. The rest of the
 * canvas' meta line ("No. 214 · 4 bars · loops forever") is still deliberately
 * absent: only the tempo is backed by data worth showing.
 */
export function GrooveCard({ groove, date, children }: GrooveCardProps) {
  return (
    <Card>
      <Stack gap="lg">
        <Heading level={2} size="lg">
          {groove.name}
        </Heading>
        <Text tone="muted" size="sm">
          {`${groove.bpm} bpm · ${dateLine(date)}`}
        </Text>
        {children}
      </Stack>
    </Card>
  )
}
