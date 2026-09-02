import type { ReactNode } from 'react'
import { Heading } from '@/components/typography/Heading'
import { Text } from '@/components/typography/Text'
import { Row } from '@/components/layout/Row'
import { Stack } from '@/components/layout/Stack'
import { APP_NAME, TAGLINE } from '@/lib/branding'
import { HelpToggle } from './HelpToggle'
import { StreakBadge } from './StreakBadge'

type GrooveHeaderProps = {
  streak: number
  onShowHelp: (() => void) | null
  share?: ReactNode
}

export function GrooveHeader({ streak, onShowHelp, share }: GrooveHeaderProps) {
  return (
    <header>
      <Row gap="lg" align="center" justify="between" collapseBelow="sm">
        <div className="min-w-0 self-start sm:self-auto">
          <Stack gap="xs">
            <Heading level={1} size="xl">
              {APP_NAME}
            </Heading>
            <Text tone="muted">
              {TAGLINE}{' '}
              {onShowHelp && <HelpToggle onShow={onShowHelp} />}
            </Text>
          </Stack>
        </div>

        <div className="self-end sm:self-auto">
          {share ? (
            <Row gap="sm" align="center">
              {share}
              <StreakBadge streak={streak} />
            </Row>
          ) : (
            <StreakBadge streak={streak} />
          )}
        </div>
      </Row>
    </header>
  )
}
