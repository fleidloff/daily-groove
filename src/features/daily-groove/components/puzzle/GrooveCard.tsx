import type { ReactNode } from 'react'
import { Card } from '@/components/surfaces/Card'
import { Heading } from '@/components/typography/Heading'
import { Text } from '@/components/typography/Text'
import { Stack } from '@/components/layout/Stack'
import { dateLine } from '../../lib/presentation/date'
import type { Answer, Groove } from '../../types'

type GrooveCardProps = {
  groove: Groove
  /**
   * The day being shown, repeated from the page header beside the tempo.
   * Passed in rather than read from the clock so the route owns "today" — the
   * same day that selects the groove — and so this card is testable without
   * fake timers, matching `GrooveHeader`.
   */
  date: Date
  /**
   * The day's answer, once the day is over — solved or given up — and `null`
   * until then. It joins the meta line beside the tempo, so the card the player
   * is still playing along to says what they are playing over. Null before the
   * day ends: the root and the mode are the puzzle.
   */
  answer?: Answer | null
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
 *
 * Once the day is over the answer joins that line, beside the tempo. The payoff
 * panel names it too, but the panel is below both cards and out of view while
 * you are playing along; the two facts a player jamming over the loop needs —
 * how fast, and in what — belong on the card that is playing.
 */
export function GrooveCard({ groove, date, answer, children }: GrooveCardProps) {
  const meta = [
    `${groove.bpm} bpm`,
    ...(answer ? [`${answer.root} ${answer.flavour}`] : []),
    dateLine(date),
  ].join(' · ')

  return (
    <Card>
      <Stack gap="lg">
        <Heading level={2} size="lg">
          {groove.name}
        </Heading>
        <Text tone="muted" size="sm">
          {meta}
        </Text>
        {children}
      </Stack>
    </Card>
  )
}
