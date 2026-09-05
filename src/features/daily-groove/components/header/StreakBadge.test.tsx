import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { header } from '@/lib/snippets'
import { StreakBadge } from './StreakBadge'

describe('StreakBadge', () => {
  it('renders the fire and the count, and nothing else (quick 4)', () => {
    render(<StreakBadge streak={5} />)
    expect(screen.getByLabelText(header.streakName({ days: 5 })).textContent).toBe(
      '🔥5',
    )
  })

  it('renders a zero rather than words when there is no streak (quick 4)', () => {
    render(<StreakBadge streak={0} />)
    expect(screen.getByLabelText(header.streakName({ days: 0 })).textContent).toBe(
      '🔥0',
    )
  })

  it('keeps the fire out of the accessible name (quick 4)', () => {
    render(<StreakBadge streak={5} />)
    expect(screen.getByText('🔥')).toHaveAttribute('aria-hidden', 'true')
  })

  it('names the streak with its count for a screen reader (quick 4)', () => {
    render(<StreakBadge streak={12} />)
    expect(
      screen.getByLabelText(header.streakName({ days: 12 })),
    ).toBeInTheDocument()
    expect(
      screen.getByLabelText(header.streakName({ days: 12 })).textContent,
    ).not.toMatch(/day/i)
  })
})
