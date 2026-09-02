'use client'

import { Card } from '@/components/surfaces/Card'
import { Heading } from '@/components/typography/Heading'
import { Row } from '@/components/layout/Row'
import { Stack } from '@/components/layout/Stack'
import { Text } from '@/components/typography/Text'

type HowToPlayProps = {
  onClose: () => void
}

const STEPS = [
  'Listen to the groove 🎧',
  'Jam along 🎸',
  'Guess the Root & Mode 🎯',
  'Come back every day for a new challenge ⏭',
]

const DRUM_CREDIT = 'Drum samples provided by DrumGizmo.org'
const DRUM_CREDIT_URL = 'https://drumgizmo.org'
const DRUM_CREDIT_LICENCE = 'CC BY 4.0'
const DRUM_CREDIT_LICENCE_URL = 'https://creativecommons.org/licenses/by/4.0/'

const CREDIT_LINK =
  'underline decoration-border-strong underline-offset-2 transition-colors hover:text-text-muted focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

function splitMark(step: string): { words: string; mark: string } {
  const cut = step.lastIndexOf(' ')
  return { words: step.slice(0, cut + 1), mark: step.slice(cut + 1) }
}

export function HowToPlay({ onClose }: HowToPlayProps) {
  return (
    <Card tone="inset">
      <Stack gap="md">
        <Row gap="md" align="center" justify="between">
          <Heading level={2} size="sm">
            How to play
          </Heading>

          <button
            type="button"
            aria-label="Close how to play"
            onClick={onClose}
            className="inline-flex h-[22px] w-[22px] shrink-0 cursor-pointer items-center justify-center rounded-full border border-border text-[13px] leading-none text-text-muted transition-colors hover:border-border-strong hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </Row>

        <ol className="flex list-decimal flex-col gap-2 pl-6 marker:font-semibold marker:text-accent">
          {STEPS.map((step) => {
            const { words, mark } = splitMark(step)
            return (
              <li
                key={step}
                className="text-[16px] font-medium leading-[1.5] text-text"
              >
                {words}
                <span aria-hidden="true">{mark}</span>
              </li>
            )
          })}
        </ol>

        <Text tone="faint" size="sm">
          <a
            href={DRUM_CREDIT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={CREDIT_LINK}
          >
            {DRUM_CREDIT}
          </a>
          {' · '}
          <a
            href={DRUM_CREDIT_LICENCE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={CREDIT_LINK}
          >
            {DRUM_CREDIT_LICENCE}
          </a>
        </Text>
      </Stack>
    </Card>
  )
}
