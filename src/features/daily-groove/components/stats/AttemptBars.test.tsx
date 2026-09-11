import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Distribution } from '../../lib/stats/types'
import { AttemptBars } from './AttemptBars'

const ALL: Distribution = {
  '1': 4,
  '2': 7,
  '3': 9,
  '4': 5,
  '5': 3,
  '6+': 1,
  revealed: 8,
}

const LAST7: Distribution = {
  '1': 1,
  '2': 2,
  '3': 2,
  '4': 0,
  '5': 1,
  '6+': 0,
  revealed: 1,
}

const attempts = { all: ALL, last7: LAST7 }

const bars = () => within(screen.getByTestId('attempt-bars'))

describe('AttemptBars', () => {
  it('renders one bar per bucket, seven of them', () => {
    render(<AttemptBars attempts={attempts} />)

    const rows = bars().getAllByRole('listitem')
    expect(rows).toHaveLength(7)
    expect(rows.map((row) => row.textContent)).toEqual([
      '14',
      '27',
      '39',
      '45',
      '53',
      '6+1',
      'revealed8',
    ])
  })

  it('shows all data first, and says so', () => {
    render(<AttemptBars attempts={attempts} />)

    expect(screen.getByRole('button', { name: 'All data' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: 'Last 7 days' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
    expect(screen.getByTestId('attempt-window-note').textContent ?? '').toMatch(
      /all the grooves/i,
    )
  })

  it('flips to the seven-day window when the switch is pressed', async () => {
    const user = userEvent.setup()
    render(<AttemptBars attempts={attempts} />)

    await user.click(screen.getByRole('button', { name: 'Last 7 days' }))

    expect(bars().getAllByRole('listitem').map((row) => row.textContent)).toEqual([
      '11',
      '22',
      '32',
      '40',
      '51',
      '6+0',
      'revealed1',
    ])
    expect(screen.getByTestId('attempt-window-note').textContent ?? '').toMatch(
      /last 7 days/i,
    )
  })

  it('flips back to all data', async () => {
    const user = userEvent.setup()
    render(<AttemptBars attempts={attempts} />)

    await user.click(screen.getByRole('button', { name: 'Last 7 days' }))
    await user.click(screen.getByRole('button', { name: 'All data' }))

    expect(bars().getAllByRole('listitem')[2].textContent).toBe('39')
  })

  it('states no percentage anywhere', () => {
    const { container } = render(<AttemptBars attempts={attempts} />)

    expect(container.textContent ?? '').not.toContain('%')
  })
})
