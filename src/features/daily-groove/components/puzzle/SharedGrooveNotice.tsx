import Link from 'next/link'
import { Card } from '@/components/surfaces/Card'
import { Stack } from '@/components/layout/Stack'
import { Text } from '@/components/typography/Text'

type SharedGrooveNoticeProps = {
  /** Where today's puzzle lives. Defaults to `/`, which is the only answer. */
  homeHref?: string
}

/**
 * What a shared groove says about itself, above the puzzle it frames (R1, R2).
 *
 * A player who solves a shared groove and finds their streak unmoved has been
 * misled by the page. So the page says it first, in words, before anything is
 * pressed (R3): this is somebody's groove, not today's, and playing it costs
 * nothing. The absence of a change is then expected rather than a bug.
 *
 * It carries the way back too — the one link a shared page has until the puzzle
 * ends, and a `next/link` rather than a button because it is navigation, not an
 * action (R5, R7). Its own text names the destination, so it still reads as the
 * way back when it is read out of context.
 *
 * On the recessed inset surface and above the two-column row, exactly where
 * `HowToPlay` sits: an aside that precedes the game it frames and never covers
 * it. Not a banner and not a modal — there is nothing here to acknowledge.
 *
 * A separate component rather than a branch inside `GrooveCard`, so nothing
 * about the daily card moves.
 */
export function SharedGrooveNotice({ homeHref = '/' }: SharedGrooveNoticeProps) {
  return (
    <Card tone="inset">
      <Stack gap="sm">
        <Text tone="muted">
          This is a shared groove, not today&apos;s puzzle. Playing it
          won&apos;t change your streak, and it won&apos;t use up your day.
        </Text>
        <Text>
          <Link href={homeHref}>Back to today&apos;s puzzle</Link>
        </Text>
      </Stack>
    </Card>
  )
}
