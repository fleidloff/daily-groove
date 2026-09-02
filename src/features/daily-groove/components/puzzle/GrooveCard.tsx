import type { ReactNode } from 'react'
import { Card } from '@/components/surfaces/Card'
import { Heading } from '@/components/typography/Heading'
import { Text } from '@/components/typography/Text'
import { Stack } from '@/components/layout/Stack'
import type { Groove } from '../../types'

type GrooveCardProps = {
  groove: Groove
  meta: string
  children?: ReactNode
}

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
