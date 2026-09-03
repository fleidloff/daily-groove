import Link from 'next/link'
import { Text } from '@/components/typography/Text'
import { puzzle, routes } from '@/lib/snippets'

type PlayTodayLinkProps = {
  homeHref?: string
}

export function PlayTodayLink({ homeHref = '/' }: PlayTodayLinkProps) {
  return (
    <Text tone="muted">
      {puzzle.playTodayIntro}{' '}
      <Link href={homeHref}>{routes.playTodayLink}</Link>
      {puzzle.playTodayOutro}
    </Text>
  )
}
