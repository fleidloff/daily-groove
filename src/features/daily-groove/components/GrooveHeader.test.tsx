import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GrooveHeader } from './GrooveHeader'

// 29 August 2026 — a Saturday. Constructed in local time so the component's
// local-calendar formatting cannot shift the day. The date is a prop, so this
// test needs no fake timers.
const DATE = new Date(2026, 7, 29)

describe('GrooveHeader', () => {
  it('drops the wordmark in favour of the date (R1, AC1)', () => {
    render(<GrooveHeader date={DATE} streak={12} />)
    expect(screen.queryByText('daily-groove')).toBeNull()
    expect(screen.getByText('Saturday, 29 August')).toBeInTheDocument()
  })

  it('sets the page title (R2, AC2)', () => {
    render(<GrooveHeader date={DATE} streak={12} />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Daily Groove' }),
    ).toBeInTheDocument()
  })

  it('shows the date it was given as one line (R1a, AC1a)', () => {
    render(<GrooveHeader date={DATE} streak={12} />)
    expect(screen.getByText('Saturday, 29 August')).toBeInTheDocument()
    // The weekday is no longer an element of its own.
    expect(screen.queryByText('Saturday')).toBeNull()
  })

  it('formats a different date from the same props', () => {
    render(<GrooveHeader date={new Date(2026, 0, 1)} streak={0} />)
    expect(screen.getByText('Thursday, 1 January')).toBeInTheDocument()
  })

  it('carries the streak pill (R3)', () => {
    render(<GrooveHeader date={DATE} streak={12} />)
    const badge = screen.getByLabelText(/current streak/i)
    expect(badge).toHaveTextContent('12 days streak')
  })
})
