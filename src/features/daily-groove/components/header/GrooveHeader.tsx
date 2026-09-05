import type { ReactNode } from 'react'
import { Heading } from '@/components/typography/Heading'
import { Text } from '@/components/typography/Text'
import { Row } from '@/components/layout/Row'
import { Stack } from '@/components/layout/Stack'
import { branding } from '@/lib/snippets'
import { HelpToggle } from './HelpToggle'
import { StreakBadge } from './StreakBadge'

type GrooveHeaderProps = {
  streak: number
  onShowHelp: (() => void) | null
  share?: ReactNode
  transpose?: ReactNode
}

export function GrooveHeader({
  streak,
  onShowHelp,
  share,
  transpose,
}: GrooveHeaderProps) {
  return (
    <header>
      <Stack gap="sm">
        <Stack gap="xs">
          <Row gap="lg" align="center" justify="between">
            <Heading level={1} size="xl">
              {branding.appName}
            </Heading>
            <StreakBadge streak={streak} />
          </Row>
          <Text tone="muted">
            {branding.tagline}{' '}
            {onShowHelp && <HelpToggle onShow={onShowHelp} />}
          </Text>
        </Stack>

        {share || transpose ? (
          <Row gap="sm" align="center" justify="end">
            {transpose}
            {share}
          </Row>
        ) : null}
      </Stack>
    </header>
  )
}
