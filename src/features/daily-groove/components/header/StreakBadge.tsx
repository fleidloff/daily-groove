import { Pill } from '@/components/display/Pill'
import { header } from '@/lib/snippets'

type StreakBadgeProps = {
  streak: number
}

export function StreakBadge({ streak }: StreakBadgeProps) {
  return (
    <div aria-label={header.streakName({ days: streak })}>
      <Pill icon={<span aria-hidden="true">🔥</span>}>
        {header.streakCount({ days: streak })}
      </Pill>
    </div>
  )
}
