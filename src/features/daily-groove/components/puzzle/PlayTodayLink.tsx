import Link from 'next/link'
import { Text } from '@/components/typography/Text'

type PlayTodayLinkProps = {
  homeHref?: string
}

export function PlayTodayLink({ homeHref = '/' }: PlayTodayLinkProps) {
  return (
    <Text tone="muted">
      That was a shared groove.{' '}
      <Link href={homeHref}>Play today&apos;s groove</Link> — your own streak is
      waiting.
    </Text>
  )
}
