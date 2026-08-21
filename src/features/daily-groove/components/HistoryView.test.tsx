import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { HistoryView } from './HistoryView'
import type { DailyResult } from '../types'

const RESULTS: DailyResult[] = [
  {
    date: '2026-08-21',
    guesses: { scale: 'C minor', chord: 'Dmaj7' },
    correctness: { scale: true, chord: false },
  },
  {
    date: '2026-08-20',
    guesses: { scale: 'A minor' },
    correctness: { scale: false }, // non-qualifying: zero correct attempts
  },
  {
    date: '2026-08-19',
    guesses: { progression: 'Dm–G–C' },
    correctness: { progression: true },
  },
]

function rowFor(date: string) {
  return screen.getByRole('listitem', { name: new RegExp(date) })
}

describe('HistoryView', () => {
  it('renders one row per result', () => {
    render(<HistoryView results={RESULTS} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('renders rows in the given order (most-recent first)', () => {
    render(<HistoryView results={RESULTS} />)
    const rows = screen.getAllByRole('listitem')
    expect(within(rows[0]).getByText(/2026-08-21/)).toBeInTheDocument()
    expect(within(rows[1]).getByText(/2026-08-20/)).toBeInTheDocument()
    expect(within(rows[2]).getByText(/2026-08-19/)).toBeInTheDocument()
  })

  it('shows the per-attribute outcome for a day', () => {
    render(<HistoryView results={RESULTS} />)
    const row = rowFor('2026-08-21')
    expect(within(row).getByText(/scale/i)).toBeInTheDocument()
    expect(within(row).getByText(/chord/i)).toBeInTheDocument()
    // scale correct, chord incorrect
    expect(within(row).getByText('Correct')).toBeInTheDocument()
    expect(within(row).getByText('Incorrect')).toBeInTheDocument()
  })

  it('still shows a non-qualifying day (zero correct attempts)', () => {
    render(<HistoryView results={RESULTS} />)
    const row = rowFor('2026-08-20')
    expect(within(row).getByText(/scale/i)).toBeInTheDocument()
    expect(within(row).getByText('Incorrect')).toBeInTheDocument()
  })

  it('renders an empty state when there are no results', () => {
    render(<HistoryView results={[]} />)
    expect(screen.queryAllByRole('listitem')).toHaveLength(0)
    expect(screen.getByText(/no (games|history|days) yet/i)).toBeInTheDocument()
  })
})
