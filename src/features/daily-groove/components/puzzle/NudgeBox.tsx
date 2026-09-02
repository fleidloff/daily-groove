import { EyebrowLabel } from '@/components/typography/EyebrowLabel'
import { Stack } from '@/components/layout/Stack'
import type { Feedback } from '../../lib/presentation/feedback'
import { FeedbackLine } from './FeedbackLine'

type NudgeBoxProps = {
  feedback: Feedback | null
  coaching: Feedback | null
  eliminated: number | null
}

export function NudgeBox({ feedback, coaching, eliminated }: NudgeBoxProps) {
  const message = feedback && feedback.message.trim() !== '' ? feedback : null
  const move = coaching && coaching.message.trim() !== '' ? coaching : null
  const count = eliminated !== null && eliminated > 0 ? eliminated : null

  if (message === null && move === null && count === null) return null

  return (
    <aside
      aria-label="Hint"
      className="rounded-panel border border-border bg-surface-inset px-4 py-[14px]"
    >
      <Stack gap="xs">
        <EyebrowLabel>Hint</EyebrowLabel>
        <div role="status" aria-live="polite">
          <Stack gap="xs">
            {message !== null && <FeedbackLine feedback={message} />}
            {move !== null && <FeedbackLine feedback={move} />}
            {count !== null && (
              <p className="text-[14px] leading-[1.5] text-text-muted">
                {count} roots ruled out. Narrowing as you go.
              </p>
            )}
          </Stack>
        </div>
      </Stack>
    </aside>
  )
}
