import type { Attribute } from '../types'

export type BreakdownRow = {
  attribute: Attribute
  attempted: boolean
  guess?: string
  correct?: boolean
  answer: string // the groove's correct value, always revealed
}

type ResultBreakdownProps = {
  rows: BreakdownRow[]
}

const LABELS: Record<Attribute, string> = {
  scale: 'Scale',
  chord: 'Chord',
  progression: 'Progression',
}

function outcome(row: BreakdownRow): string {
  if (!row.attempted) return 'Skipped'
  return row.correct ? 'Correct' : 'Incorrect'
}

/**
 * Per-attribute result breakdown. Each attempted attribute shows correct or
 * incorrect; each unattempted attribute shows skipped. The correct answer is
 * always revealed.
 */
export function ResultBreakdown({ rows }: ResultBreakdownProps) {
  return (
    <ul>
      {rows.map((row) => (
        <li key={row.attribute} aria-label={LABELS[row.attribute]}>
          <span>{LABELS[row.attribute]}</span>
          <span>{outcome(row)}</span>
          <span>
            Answer: <strong>{row.answer}</strong>
          </span>
        </li>
      ))}
    </ul>
  )
}
