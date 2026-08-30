import type { ReactNode } from 'react'
import { Card } from '@/components/Card'
import { Heading } from '@/components/Heading'
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
 * The header region carries the groove's name alone. The tempo is display-only
 * data that drives nothing on screen, so it is not rendered; the canvas' meta
 * line ("No. 214 · 4 bars · loops forever") is dropped rather than filled,
 * since none of it is backed by real data.
 */
export function GrooveCard({ groove, children }: GrooveCardProps) {
  return (
    <Card>
      <Stack gap="lg">
        <Heading level={2} size="lg">
          {groove.name}
        </Heading>
        {children}
      </Stack>
    </Card>
  )
}
