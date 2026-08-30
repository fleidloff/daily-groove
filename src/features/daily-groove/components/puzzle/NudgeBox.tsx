import { EyebrowLabel } from '@/components/typography/EyebrowLabel'
import { Stack } from '@/components/layout/Stack'

type NudgeBoxProps = {
  /** The day's correct root, which the nudge reveals by name. */
  root: string
}

/**
 * The hint box that appears under the check control once two guesses have
 * missed. It reveals the day's root and nothing else: no control, no selection,
 * no filtering of the chips — the player still makes the choice themselves.
 *
 * A named live region rather than a second `role="status"`, so the feedback
 * line stays the card's one status while the nudge's arrival is still
 * announced.
 */
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
