import { EyebrowLabel } from '@/components/typography/EyebrowLabel'
import { Stack } from '@/components/layout/Stack'

type NudgeBoxProps = {
  root: string
}

export function NudgeBox({ root }: NudgeBoxProps) {
  return (
    <aside
      aria-label="A nudge"
      aria-live="polite"
      className="rounded-panel border border-border bg-surface-inset px-4 py-[14px]"
    >
      <Stack gap="xs">
        <EyebrowLabel>A nudge</EyebrowLabel>
        <p className="text-[14px] leading-[1.5] text-text-muted">
          The day&rsquo;s root is{' '}
          <span className="font-display text-[15px] text-text">{root}</span>. That
          leaves the flavour to find.
        </p>
      </Stack>
    </aside>
  )
}
