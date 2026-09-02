import type { Feedback, FeedbackTone } from '../../lib/presentation/feedback'

type FeedbackLineProps = {
  feedback: Feedback
}

const TONE: Record<FeedbackTone, string> = {
  neutral: 'text-text-muted',
  warm: 'text-warm',
  solved: 'text-accent-soft',
}

export function FeedbackLine({ feedback }: FeedbackLineProps) {
  return (
    <p
      data-tone={feedback.tone}
      className={`text-[14.5px] leading-[1.55] ${TONE[feedback.tone]}`}
    >
      {feedback.message}
    </p>
  )
}
