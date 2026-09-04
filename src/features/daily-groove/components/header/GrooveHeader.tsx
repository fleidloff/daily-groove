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
      <Row gap="lg" align="center" justify="between" collapseBelow="sm">
        <div className="min-w-0 self-start sm:self-auto">
          <Stack gap="xs">
            <Heading level={1} size="xl">
              {branding.appName}
            </Heading>
            <Text tone="muted">
              {branding.tagline}{' '}
              {onShowHelp && <HelpToggle onShow={onShowHelp} />}
            </Text>
          </Stack>
        </div>

        <div className="self-end sm:self-auto">
          {share || transpose ? (
            <Row gap="sm" align="center">
              {transpose}
              <StreakBadge streak={streak} />
              {share}
            </Row>
          ) : (
            <StreakBadge streak={streak} />
          )}
        </div>
      </Row>
    </header>
  )
}
