import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { NudgeBox } from './NudgeBox'

describe('NudgeBox', () => {
  it('carries the "A nudge" eyebrow (R6, AC9)', () => {
    render(<NudgeBox root="G" />)
    expect(screen.getByText(/a nudge/i)).toBeInTheDocument()
  })

  it('names the given root as the root of the day (R6, AC9)', () => {
    const { container } = render(<NudgeBox root="G" />)
    expect(container).toHaveTextContent(/root is G\b/i)
  })

  it('names a different root when given one (R6, AC9)', () => {
    const { container } = render(<NudgeBox root="B♭" />)
    expect(container).toHaveTextContent(/root is B♭/i)
    expect(container).not.toHaveTextContent(/root is G\b/i)
  })

  it('is a named live region, so its arrival is announced (R10, AC14)', () => {
    render(<NudgeBox root="G" />)
    const nudge = screen.getByRole('complementary', { name: /a nudge/i })
    expect(nudge).toHaveAttribute('aria-live', 'polite')
    expect(nudge).toHaveTextContent(/root is G\b/i)
  })

  it('leaves the feedback line the only status region (R5)', () => {
    // The nudge is additional context beside the feedback line, not a second
    // status: the card must still have exactly one role="status".
    render(<NudgeBox root="G" />)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
  })

  it('is informational only — it offers no control to press (R6, AC10)', () => {
    render(<NudgeBox root="G" />)
    expect(screen.queryByRole('button')).not.toBeInTheDocument()
  })
})
