'use client'

import { Card } from '@/components/surfaces/Card'
import { Heading } from '@/components/typography/Heading'
import { Row } from '@/components/layout/Row'
import { Stack } from '@/components/layout/Stack'
import { Text } from '@/components/typography/Text'
import { intro } from '@/lib/snippets'

type HowToPlayProps = {
  onClose: () => void
}

export function HowToPlay({ onClose }: HowToPlayProps) {
  return (
    <Card tone="inset">
      <Stack gap="md">
        <Row gap="md" align="center" justify="between">
          <Heading level={2} size="sm">
            {intro.title}
          </Heading>

          <button
            type="button"
            aria-label={intro.closeName}
            onClick={onClose}
            className="inline-flex h-[22px] w-[22px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-border text-[13px] leading-none text-text-muted transition-colors hover:border-border-strong hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </Row>

        <ol className="flex list-decimal flex-col gap-2 pl-6 marker:font-semibold marker:text-accent">
          {intro.steps.map((step) => (
            <li
              key={`${step.words}${step.mark}`}
              className="text-[16px] font-medium leading-[1.5] text-text"
            >
              {step.words}
              <span aria-hidden="true">{step.mark}</span>
            </li>
          ))}
        </ol>

        <Text tone="muted">{intro.twoWays}</Text>
      </Stack>
    </Card>
  )
}
