import Link from 'next/link'
import { Card } from '@/components/surfaces/Card'
import { Stack } from '@/components/layout/Stack'
import { Text } from '@/components/typography/Text'

type SharedGrooveNoticeProps = {
  homeHref?: string
}

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
