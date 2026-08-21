import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StreakBadge } from './StreakBadge'

describe('StreakBadge', () => {
  it('renders the streak count', () => {
    render(<StreakBadge streak={5} />)
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders a zero/empty state when the streak is 0', () => {
    render(<StreakBadge streak={0} />)
    // The count is shown as zero...
    expect(screen.getByText('0')).toBeInTheDocument()
    // ...and a zero-streak affordance is present.
    expect(screen.getByText(/no streak yet/i)).toBeInTheDocument()
  })
})
