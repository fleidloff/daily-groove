import { Heading } from '@/components/typography/Heading'
import { Row } from '@/components/layout/Row'
import { Stack } from '@/components/layout/Stack'
import { StreakBadge } from './StreakBadge'
import { dateLine } from '../../lib/presentation/date'

type GrooveHeaderProps = {
  /**
   * The day being shown. Passed in rather than read from the clock so the route
   * owns "today" — the same day that selects the groove — and so this component
   * is testable without fake timers.
   */
  date: Date
  streak: number
}

/**
 * The page header: the date on the left, the title beneath it, and the streak
 * pill on the right.
 */
export function GrooveHeader({ date, streak }: GrooveHeaderProps) {
  return (
    <header>
      <Row gap="lg" align="start" justify="between" collapseBelow="sm">
        <Stack gap="xs">
          <span className="text-[14px] leading-none text-text-muted">
            {dateLine(date)}
          </span>
          <Heading level={1} size="xl">
            Daily Groove
          </Heading>
        </Stack>

        <StreakBadge streak={streak} />
      </Row>
    </header>
  )
}
