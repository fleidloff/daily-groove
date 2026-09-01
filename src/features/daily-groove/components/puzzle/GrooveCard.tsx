import type { ReactNode } from 'react'
import { Card } from '@/components/surfaces/Card'
import { Heading } from '@/components/typography/Heading'
import { Text } from '@/components/typography/Text'
import { Stack } from '@/components/layout/Stack'
import type { Groove } from '../../types'

type GrooveCardProps = {
  groove: Groove
  /**
   * The finished meta line beside the name, e.g. "96 bpm · Sunday, 30 August".
   *
   * Composed by the view and handed over whole, rather than assembled here from
   * a tempo and a date: the same card heads two pages, and what differs between
   * them is this string, not the card's logic. See `lib/presentation/date.ts`.
   */
  meta: string
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
 * Once the day is over the answer joins that line — the payoff panel names it
 * too, but the panel is a separate card that scrolls away from the transport as
 * soon as you look at anything else, and the two facts a player jamming over the
 * loop needs are how fast and in what. Since feature-15 Epic 5 the panel sits
 * *beside* this card in the row's second column rather than below both cards, so
 * the duplication is a few pixels wide on a wide screen and still worth it on a
 * phone, where the row is one column and the panel is below this card
 * (F15 E5 R6a, AC10). The card does not put it there: `metaLine` composes the whole
 * string, so this component branches on nothing at all and the two pages that
 * render it differ in data rather than in logic (F12 E3 R4).
 */
export function GrooveCard({ groove, meta, children }: GrooveCardProps) {
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
