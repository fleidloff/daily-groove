import { EyebrowLabel } from '@/components/typography/EyebrowLabel'
import { Stack } from '@/components/layout/Stack'
import type { Feedback } from '../../lib/presentation/feedback'
import { FeedbackLine } from './FeedbackLine'

type NudgeBoxProps = {
  feedback: Feedback | null
  eliminated: number | null
}

export function NudgeBox({ feedback, eliminated }: NudgeBoxProps) {
  const message =
    feedback !== null && feedback.message.trim() !== '' ? feedback : null
  const count = eliminated !== null && eliminated > 0 ? eliminated : null

  if (message === null && count === null) return null

  return (
    <aside
      aria-label="Hint"
      className="rounded-panel border border-border bg-surface-inset px-4 py-[14px]"
    >
      <Stack gap="xs">
        <EyebrowLabel>Hint</EyebrowLabel>
        {message !== null && <FeedbackLine feedback={message} />}
        {count !== null && (
          <p className="text-[14px] leading-[1.5] text-text-muted">
            {count} roots ruled out. Narrowing as you go.
          </p>
        )}
      </Stack>
    </aside>
  )
}
