import Link from 'next/link'
import { Text } from '@/components/typography/Text'

type PlayTodayLinkProps = {
  /** Where today's puzzle lives. Defaults to `/`, which is the only answer. */
  homeHref?: string
}

/**
 * What a played-out shared groove offers next: today's (R5a).
 *
 * A shared link that ends with an answer and nowhere to go is a dead end, and
 * the player who arrived through it has still not met the daily puzzle. So both
 * endings — solved, and given up on — close with the same line, worded the same
 * way (R5b), and it stays for the rest of the session exactly as the payoff
 * panel above it does.
 *
 * A sibling rendered *after* `SolvedPanel` (`../solved/SolvedPanel`, its own
 * screen region since feature-15), never folded into it: that panel is
 * the day's payoff on both pages, and teaching it what a shared groove is would
 * make the one component both pages render the second place that knows.
 *
 * It never appears on `/` — there the player is already on today's groove
 * (R5c) — and like the notice above the cards it is a `next/link` to `/`, which
 * is the only destination a shared page has (R7).
 */
export function PlayTodayLink({ homeHref = '/' }: PlayTodayLinkProps) {
  return (
    <Text tone="muted">
      That was a shared groove.{' '}
      <Link href={homeHref}>Play today&apos;s groove</Link> — your own streak is
      waiting.
    </Text>
  )
}
