import { Heading } from '@/components/Heading'
import { Row } from '@/components/Row'
import { Stack } from '@/components/Stack'
import { StreakBadge } from './StreakBadge'

type GrooveHeaderProps = {
  /**
   * The day being shown. Passed in rather than read from the clock so the route
   * owns "today" — the same day that selects the groove — and so this component
   * is testable without fake timers.
   */
  date: Date
  streak: number
}

// Pinned to en-GB so the day-and-month reads "29 August" regardless of the
// viewer's locale, which is the form the design sets. The *day* itself is still
// the viewer's local calendar day; only its wording is fixed.
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { weekday: 'long' })
const DAY_MONTH = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
})

// Two formatters composed rather than one Intl call: en-GB's combined
// weekday/day/month format omits the comma this line needs.
const DATE_LINE = (d: Date) => `${WEEKDAY.format(d)}, ${DAY_MONTH.format(d)}`

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
            {DATE_LINE(date)}
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
