import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StreakBadge } from './StreakBadge'

describe('StreakBadge', () => {
  it('renders a legible empty state at zero rather than "0 days streak" (R4, AC4)', () => {
    render(<StreakBadge streak={0} />)
    expect(screen.getByText(/no streak yet/i)).toBeInTheDocument()
    expect(screen.queryByText(/\b0 days?\b/)).not.toBeInTheDocument()
  })

  it('renders the singular at one (R3, AC3)', () => {
    render(<StreakBadge streak={1} />)
    expect(screen.getByText('1 day streak')).toBeInTheDocument()
  })

  it('renders the plural above one (R3, AC3)', () => {
    render(<StreakBadge streak={3} />)
    expect(screen.getByText('3 days streak')).toBeInTheDocument()
  })

  it('is labelled as the current streak', () => {
    render(<StreakBadge streak={12} />)
    expect(screen.getByLabelText(/current streak/i)).toBeInTheDocument()
  })
})
