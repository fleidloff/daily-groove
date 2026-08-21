import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { ResultBreakdown, type BreakdownRow } from './ResultBreakdown'

const ROWS: BreakdownRow[] = [
  { attribute: 'scale', attempted: true, guess: 'C minor', correct: true, answer: 'C minor' },
  { attribute: 'chord', attempted: true, guess: 'A7', correct: false, answer: 'Dmaj7' },
  { attribute: 'progression', attempted: false, answer: 'Dm–G–C' },
]

function rowFor(attribute: string) {
  return screen.getByRole('listitem', { name: new RegExp(attribute, 'i') })
}

describe('ResultBreakdown', () => {
  it('renders one row per attribute', () => {
    render(<ResultBreakdown rows={ROWS} />)
    expect(screen.getAllByRole('listitem')).toHaveLength(3)
  })

  it('marks an attempted, correct attribute and shows its answer', () => {
    render(<ResultBreakdown rows={ROWS} />)
    const row = rowFor('scale')
    expect(within(row).getByText(/correct/i)).toBeInTheDocument()
    expect(within(row).getByText(/C minor/)).toBeInTheDocument()
  })

  it('marks an attempted, incorrect attribute and shows the correct answer', () => {
    render(<ResultBreakdown rows={ROWS} />)
    const row = rowFor('chord')
    expect(within(row).getByText(/incorrect/i)).toBeInTheDocument()
    expect(within(row).getByText(/Dmaj7/)).toBeInTheDocument()
  })

  it('shows an unattempted attribute as skipped, with the answer still revealed', () => {
    render(<ResultBreakdown rows={ROWS} />)
    const row = rowFor('progression')
    expect(within(row).getByText(/skipped/i)).toBeInTheDocument()
    expect(within(row).getByText(/Dm–G–C/)).toBeInTheDocument()
  })

  it('always reveals the answer for every row', () => {
    render(<ResultBreakdown rows={ROWS} />)
    expect(within(rowFor('scale')).getByText(/C minor/)).toBeInTheDocument()
    expect(within(rowFor('chord')).getByText(/Dmaj7/)).toBeInTheDocument()
    expect(within(rowFor('progression')).getByText(/Dm–G–C/)).toBeInTheDocument()
  })
})
