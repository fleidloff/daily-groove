import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StreakBadge } from './StreakBadge'

describe('StreakBadge', () => {
  it('renders a legible empty state at zero rather than "0 days" (R6, AC4)', () => {
    render(<StreakBadge streak={0} />)
    expect(screen.getByText(/no streak yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/\b0 days?\b/)).not.toBeInTheDocument()
  })

  it('renders the singular at one', () => {
    render(<StreakBadge streak={1} />)
    expect(screen.getByText('1 day')).toBeInTheDocument()
  })

  it('renders the plural above one', () => {
    render(<StreakBadge streak={12} />)
    expect(screen.getByText('12 days')).toBeInTheDocument()
  })

  it('is labelled as the current streak', () => {
    render(<StreakBadge streak={12} />)
    expect(screen.getByLabelText(/current streak/i)).toBeInTheDocument()
  })
})
