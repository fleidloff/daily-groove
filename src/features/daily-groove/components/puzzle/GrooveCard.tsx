import type { ReactNode } from 'react'
import { Card } from '@/components/surfaces/Card'
import { Heading } from '@/components/typography/Heading'
import { Text } from '@/components/typography/Text'
import { Stack } from '@/components/layout/Stack'
import { puzzle } from '@/lib/snippets'
import type { Groove } from '../../types'

type GrooveCardProps = {
  groove: Groove
  meta: string
  children?: ReactNode
}

const DRUM_CREDIT_URL = 'https://drumgizmo.org'
const DRUM_CREDIT_LICENCE = 'CC BY 4.0'
const DRUM_CREDIT_LICENCE_URL = 'https://creativecommons.org/licenses/by/4.0/'

const CREDIT_LINK =
  'underline decoration-border-strong underline-offset-2 transition-colors hover:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

export function GrooveCard({ groove, meta, children }: GrooveCardProps) {
  return (
    <Card>
      <Stack gap='lg' fill>
        <Heading level={2} size='lg'>
          {groove.name}
        </Heading>
        <Text tone='muted' size='sm'>
          {meta}
        </Text>
        {children}
        <div className='mt-auto'>
          <Text tone='faint' size='sm'>
            <a
              href={DRUM_CREDIT_URL}
              target='_blank'
              rel='noopener noreferrer'
              className={CREDIT_LINK}
            >
              {puzzle.drumCredit}
            </a>
            {' · '}
            <a
              href={DRUM_CREDIT_LICENCE_URL}
              target='_blank'
              rel='noopener noreferrer'
              className={CREDIT_LINK}
            >
              {DRUM_CREDIT_LICENCE}
            </a>
          </Text>
        </div>
      </Stack>
    </Card>
  )
}
