import { EyebrowLabel } from '@/components/EyebrowLabel'
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

/**
 * The page header: brand mark and wordmark, the title, and a right-hand cluster
 * of the date and the streak pill.
 */
export function GrooveHeader({ date, streak }: GrooveHeaderProps) {
  return (
    <header>
      <Row gap="lg" align="start" justify="between" collapseBelow="sm">
        <Stack gap="xs">
          <Row gap="sm" align="center">
            <span
              aria-hidden="true"
              className="h-[9px] w-[9px] shrink-0 rounded-full bg-accent-soft"
            />
            <EyebrowLabel>daily-groove</EyebrowLabel>
          </Row>
          <Heading level={1} size="xl">
            Today&apos;s groove
          </Heading>
        </Stack>

        <Row gap="lg" align="center">
          <div className="text-right">
            <Stack gap="xs">
              <EyebrowLabel>{WEEKDAY.format(date)}</EyebrowLabel>
              <span className="font-display text-[22px] leading-none text-text">
                {DAY_MONTH.format(date)}
              </span>
            </Stack>
          </div>
          <span
            aria-hidden="true"
            className="hidden h-[38px] w-px shrink-0 bg-border-strong sm:block"
          />
          <StreakBadge streak={streak} />
        </Row>
      </Row>
    </header>
  )
}
