import type { DotState } from '../../lib/presentation/feedback'

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
 * The words that stop the row reading as three lives. They ride on the label
 * itself rather than on a tooltip component, so the same sentence reaches a
 * pointer (through `title`), a keyboard and a screen reader (R1, R2).
 */
function explanation(par: number): string {
  return `${par} is par, not a limit — you can keep guessing`
}

/**
 * The label a screen reader gets, and the `title` a pointer gets. The dots are
 * decorative once this is said, so nothing about progress depends on seeing
 * colour.
 *
 * A finished day keeps the short form: there is nothing left to explain about
 * how many guesses remain.
 */
function labelFor(states: DotState[]): string {
  if (states.some((state) => state === 'solved')) return 'Solved'

  const spent = states.filter((state) => state === 'spent').length
  return `${spent} of ${states.length} attempts spent · ${explanation(states.length)}`
}

/**
 * The attempt dots above the guessing card's check button. They mark par, not
 * lives:
 * the row is however long `dotStates` says, which is always three, so a fourth
 * miss leaves it full rather than extending it.
 */
export function AttemptDots({ states }: AttemptDotsProps) {
  const label = labelFor(states)

  return (
    <span
      role="img"
      aria-label={label}
      title={label}
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
