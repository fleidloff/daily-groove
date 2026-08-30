import { Pill } from '@/components/Pill'

type StreakBadgeProps = {
  streak: number
}

/**
 * Shows the current streak — the run of consecutive qualifying days up to today
 * — as a pill in the page header. A streak of zero reads as an empty state
 * rather than a bare "0 days", which would look like a score of nothing.
 */
export function StreakBadge({ streak }: StreakBadgeProps) {
  const label =
    streak === 0
      ? 'No streak yet'
      : `${streak} day${streak === 1 ? '' : 's'} streak`

  return (
    // The pill's own text is deliberately short, so the accessible name carries
    // what the number means.
    <div aria-label="Current streak">
      <Pill icon="●">{label}</Pill>
    </div>
  )
}
