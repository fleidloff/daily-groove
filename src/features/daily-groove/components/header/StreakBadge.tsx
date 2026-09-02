import { Pill } from '@/components/display/Pill'

type StreakBadgeProps = {
  streak: number
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  const label =
    streak === 0
      ? 'No streak yet'
      : `${streak} day${streak === 1 ? '' : 's'} streak`

  return (
    <div aria-label="Current streak">
      <Pill icon="●">{label}</Pill>
    </div>
  )
}
