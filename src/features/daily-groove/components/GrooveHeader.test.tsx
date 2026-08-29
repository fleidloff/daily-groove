import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GrooveHeader } from './GrooveHeader'

// 29 August 2026 — a Saturday. Constructed in local time so the component's
// local-calendar formatting cannot shift the day. The date is a prop, so this
// test needs no fake timers.
const DATE = new Date(2026, 7, 29)

describe('GrooveHeader', () => {
  it('carries the brand mark and the wordmark (R4, AC3)', () => {
    render(<GrooveHeader date={DATE} streak={12} />)
    expect(screen.getByText('daily-groove')).toBeInTheDocument()
  })

  it('sets the page title (R4, AC3)', () => {
    render(<GrooveHeader date={DATE} streak={12} />)
    expect(
      screen.getByRole('heading', { level: 1, name: "Today's groove" }),
    ).toBeInTheDocument()
  })

  it('shows the weekday and the day and month it was given (R5, AC3)', () => {
    render(<GrooveHeader date={DATE} streak={12} />)
    expect(screen.getByText('Saturday')).toBeInTheDocument()
    expect(screen.getByText('29 August')).toBeInTheDocument()
  })

  it('formats a different date from the same props', () => {
    render(<GrooveHeader date={new Date(2026, 0, 1)} streak={0} />)
    expect(screen.getByText('Thursday')).toBeInTheDocument()
    expect(screen.getByText('1 January')).toBeInTheDocument()
  })

  it('carries the streak pill (R6)', () => {
    render(<GrooveHeader date={DATE} streak={12} />)
    const badge = screen.getByLabelText(/current streak/i)
    expect(badge).toHaveTextContent('12 days')
  })
})
