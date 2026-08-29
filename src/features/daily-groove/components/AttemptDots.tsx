import type { DotState } from '../lib/feedback'

type AttemptDotsProps = {
  /**
   * One entry per dot, already derived by `lib/feedback`'s `dotStates`. The row
   * renders exactly what it is handed — it never counts attempts itself.
   */
  states: DotState[]
}

// Each state gets its own token, so the three read apart at a glance: the track
// green for a dot still to spend, the warm terracotta for one spent, and the
// soft accent once the day is solved.
const DOT: Record<DotState, string> = {
  unspent: 'bg-border-strong',
  spent: 'bg-warm',
  solved: 'bg-accent-soft',
}

/**
 * The label a screen reader gets. The dots are decorative once this is said, so
 * nothing about progress depends on seeing colour.
 */
function labelFor(states: DotState[]): string {
  if (states.some((state) => state === 'solved')) return 'Solved'

  const spent = states.filter((state) => state === 'spent').length
  return `${spent} of ${states.length} attempts spent`
}

/**
 * The attempt dots beside the guessing card's heading. It marks par, not lives:
 * the row is however long `dotStates` says, which is always three, so a fourth
 * miss leaves it full rather than extending it.
 */
export function AttemptDots({ states }: AttemptDotsProps) {
  return (
    <span
      role="img"
      aria-label={labelFor(states)}
      className="inline-flex items-center gap-[6px]"
    >
      {states.map((state, index) => (
        <span
          key={index}
          aria-hidden="true"
          data-dot-state={state}
          className={`h-2 w-2 shrink-0 rounded-full ${DOT[state]}`}
        />
      ))}
    </span>
  )
}
