import { Fragment } from 'react'
import type { Attribute, DailyResult } from '../types'

type HistoryViewProps = {
  results: DailyResult[] // already ordered most-recent first by the caller
}

const ATTRIBUTES: Attribute[] = ['scale', 'chord', 'progression']

const LABELS: Record<Attribute, string> = {
  scale: 'Scale',
  chord: 'Chord',
  progression: 'Progression',
}

/**
 * A history of past played days, rendered in the order given (most-recent
 * first). Each row shows the day's date and the outcome of every attempted
 * attribute. A day with zero correct attempts still appears. An empty list
 * renders a clean empty state.
 */
export function HistoryView({ results }: HistoryViewProps) {
  if (results.length === 0) {
    return <p>No games yet — play today to start your history.</p>
  }

  return (
    <ul>
      {results.map((result) => {
        const attempted = ATTRIBUTES.filter(
          (attribute) => attribute in result.guesses,
        )
        return (
          <li key={result.date} aria-label={result.date}>
            <span>{result.date}</span>
            {attempted.map((attribute) => (
              <Fragment key={attribute}>
                <span>{LABELS[attribute]}</span>
                <span>
                  {result.correctness[attribute] ? 'Correct' : 'Incorrect'}
                </span>
              </Fragment>
            ))}
          </li>
        )
      })}
    </ul>
  )
}
