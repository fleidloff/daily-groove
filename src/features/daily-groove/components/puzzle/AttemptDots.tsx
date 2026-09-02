import type { DotState } from '../../lib/presentation/feedback'

type AttemptDotsProps = {
  states: DotState[]
}

const DOT: Record<DotState, string> = {
  unspent: 'bg-border-strong',
  spent: 'bg-warm',
  solved: 'bg-accent-soft',
}

function explanation(par: number): string {
  return `${par} is par, not a limit — you can keep guessing`
}

function labelFor(states: DotState[]): string {
  if (states.some((state) => state === 'solved')) return 'Solved'

  const spent = states.filter((state) => state === 'spent').length
  return `${spent} of ${states.length} attempts spent · ${explanation(states.length)}`
}

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
