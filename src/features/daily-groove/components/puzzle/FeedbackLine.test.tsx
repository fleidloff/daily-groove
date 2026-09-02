import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeedbackLine } from './FeedbackLine'
import type { Feedback, FeedbackTone } from '../../lib/presentation/feedback'

const NEUTRAL: Feedback = { message: 'Listen for the note that rests.', tone: 'neutral' }
const WARM: Feedback = { message: 'Right home note, wrong colour.', tone: 'warm' }
const SOLVED: Feedback = { message: 'That is it. The groove is yours.', tone: 'solved' }

function classOf(feedback: Feedback): string {
  const { unmount } = render(<FeedbackLine feedback={feedback} />)
  const className = screen.getByText(feedback.message).className
  unmount()
  return className
}

describe('FeedbackLine', () => {
  it('renders the message it is given (R8)', () => {
    render(<FeedbackLine feedback={WARM} />)
    expect(screen.getByText(WARM.message)).toBeInTheDocument()
  })

  it('declares no live region of its own — the box owns the one (R17, AC20)', () => {
    render(<FeedbackLine feedback={WARM} />)
    const line = screen.getByText(WARM.message)
    expect(line).not.toHaveAttribute('role')
    expect(line).not.toHaveAttribute('aria-live')
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('renders a changed message in place of the one before it (R10, AC14)', () => {
    const { rerender } = render(<FeedbackLine feedback={NEUTRAL} />)
    expect(screen.getByText(NEUTRAL.message)).toBeInTheDocument()

    rerender(<FeedbackLine feedback={WARM} />)
    expect(screen.getByText(WARM.message)).toBeInTheDocument()
    expect(screen.queryByText(NEUTRAL.message)).toBeNull()
  })

  it('gives the three tones distinct classes (R8)', () => {
    const classes = [NEUTRAL, WARM, SOLVED].map(classOf)
    expect(new Set(classes).size).toBe(3)
  })

  it('marks the tone it rendered (R8)', () => {
    const tones: FeedbackTone[] = ['neutral', 'warm', 'solved']
    for (const tone of tones) {
      const message = `a ${tone} line`
      const { unmount } = render(<FeedbackLine feedback={{ message, tone }} />)
      expect(screen.getByText(message).dataset.tone).toBe(tone)
      unmount()
    }
  })

  it('carries the whole message in text, never in colour alone (R10, AC14)', () => {
    for (const feedback of [NEUTRAL, WARM, SOLVED]) {
      const { unmount } = render(<FeedbackLine feedback={feedback} />)
      expect(screen.getByText(feedback.message)).toHaveTextContent(
        feedback.message,
      )
      unmount()
    }
  })
})
