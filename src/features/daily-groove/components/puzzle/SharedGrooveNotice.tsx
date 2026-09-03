import Link from 'next/link'
import { Card } from '@/components/surfaces/Card'
import { Stack } from '@/components/layout/Stack'
import { Text } from '@/components/typography/Text'
import { puzzle } from '@/lib/snippets'

type SharedGrooveNoticeProps = {
  homeHref?: string
}

export function SharedGrooveNotice({ homeHref = '/' }: SharedGrooveNoticeProps) {
  return (
    <Card tone="inset">
      <Stack gap="sm">
        <Text tone="muted">{puzzle.sharedNotice}</Text>
        <Text>
          <Link href={homeHref}>{puzzle.backToToday}</Link>
        </Text>
      </Stack>
    </Card>
  )
}
