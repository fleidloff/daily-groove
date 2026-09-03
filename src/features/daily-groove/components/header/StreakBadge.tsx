import { Pill } from '@/components/display/Pill'
import { header } from '@/lib/snippets'

type StreakBadgeProps = {
  streak: number
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  const label =
    streak === 0 ? header.noStreakYet : header.streakDays({ days: streak })

  return (
    <div aria-label={header.currentStreakName}>
      <Pill icon="●">{label}</Pill>
    </div>
  )
}
