type StreakBadgeProps = {
  streak: number
}

/**
 * Shows the current streak — the run of consecutive qualifying days up to today.
 * A streak of zero renders a clean empty state rather than a bare "0".
 */
export function StreakBadge({ streak }: StreakBadgeProps) {
  return (
    <div aria-label="Current streak">
      <strong>{streak}</strong>
      <span> day{streak === 1 ? '' : 's'}</span>
      {streak === 0 && <span> — no streak yet</span>}
    </div>
  )
}
