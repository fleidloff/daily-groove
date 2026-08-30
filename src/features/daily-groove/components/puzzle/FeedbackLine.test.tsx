import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeedbackLine } from './FeedbackLine'
import type { Feedback, FeedbackTone } from '../../lib/presentation/feedback'

const NEUTRAL: Feedback = { message: 'Listen for the note that rests.', tone: 'neutral' }
const WARM: Feedback = { message: 'Right home note, wrong colour.', tone: 'warm' }
const SOLVED: Feedback = { message: 'That is it. The groove is yours.', tone: 'solved' }

/** Renders one line in isolation and hands back the class it carried. */
function classOf(feedback: Feedback): string {
  const { unmount } = render(<FeedbackLine feedback={feedback} />)
  const className = screen.getByRole('status').className
  unmount()
  return className
}

describe('FeedbackLine', () => {
  it('renders the message it is given (R8)', () => {
    render(<FeedbackLine feedback={WARM} />)
    expect(screen.getByText(WARM.message)).toBeInTheDocument()
  })

  it('puts the message in a polite live region so it is announced (R10, AC14)', () => {
    render(<FeedbackLine feedback={WARM} />)
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(WARM.message)
    expect(status).toHaveAttribute('aria-live', 'polite')
  })

  it('announces a changed message from the same live region (R10, AC14)', () => {
    const { rerender } = render(<FeedbackLine feedback={NEUTRAL} />)
    expect(screen.getByRole('status')).toHaveTextContent(NEUTRAL.message)

    rerender(<FeedbackLine feedback={WARM} />)
    expect(screen.getByRole('status')).toHaveTextContent(WARM.message)
  })

  it('gives the three tones distinct classes (R8)', () => {
    const classes = [NEUTRAL, WARM, SOLVED].map(classOf)
    expect(new Set(classes).size).toBe(3)
  })

  it('marks the tone it rendered (R8)', () => {
    const tones: FeedbackTone[] = ['neutral', 'warm', 'solved']
    for (const tone of tones) {
      const { unmount } = render(
        <FeedbackLine feedback={{ message: `a ${tone} line`, tone }} />,
      )
      expect(screen.getByRole('status').dataset.tone).toBe(tone)
      unmount()
    }
  })

  it('carries the whole message in text, never in colour alone (R10, AC14)', () => {
    // The class differs per tone, but stripping it must lose nothing: each
    // message reads on its own.
    for (const feedback of [NEUTRAL, WARM, SOLVED]) {
      const { unmount } = render(<FeedbackLine feedback={feedback} />)
      expect(screen.getByRole('status')).toHaveTextContent(feedback.message)
      unmount()
    }
  })
})
