import type { Feedback, FeedbackTone } from '../lib/feedback'

type FeedbackLineProps = {
  /** The message and its tone, already selected by `lib/feedback`. */
  feedback: Feedback
}

// Colour is a second signal, never the only one: every tone's wording differs
// on its own, so the line still reads with the palette stripped out.
const TONE: Record<FeedbackTone, string> = {
  neutral: 'text-text-muted',
  warm: 'text-warm',
  solved: 'text-accent-soft',
}

/**
 * The line under the check control. It is a polite live region, so a message
 * that changes after a guess is announced rather than only recoloured.
 */
export function FeedbackLine({ feedback }: FeedbackLineProps) {
  return (
    <p
      role="status"
      aria-live="polite"
      data-tone={feedback.tone}
      className={`text-[14.5px] leading-[1.55] ${TONE[feedback.tone]}`}
    >
      {feedback.message}
    </p>
  )
}
