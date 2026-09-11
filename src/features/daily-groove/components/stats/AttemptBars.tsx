'use client'

import { useState } from 'react'
import { Chip } from '@/components/controls/Chip'
import { Row } from '@/components/layout/Row'
import { Stack } from '@/components/layout/Stack'
import { SectionLabel } from '@/components/typography/SectionLabel'
import { Text } from '@/components/typography/Text'
import type { AttemptBucket, Distribution } from '../../lib/stats/types'
import { stats } from '@/lib/snippets'

export const BUCKETS: AttemptBucket[] = ['1', '2', '3', '4', '5', '6+', 'revealed']

type Window = 'last7' | 'all'

type AttemptBarsProps = {
  attempts: { last7: Distribution; all: Distribution }
}

function fillClass(bucket: AttemptBucket): string {
  return bucket === 'revealed'
    ? 'bg-warm text-paper-tint'
    : 'bg-accent text-on-accent'
}

export function AttemptBars({ attempts }: AttemptBarsProps) {
  const [window, setWindow] = useState<Window>('all')
  const distribution = attempts[window]
  const largest = Math.max(...BUCKETS.map((bucket) => distribution[bucket]))

  return (
    <Stack gap="md">
      <SectionLabel>{stats.attemptsLabel}</SectionLabel>

      <Row gap="sm">
        <Chip
          label={stats.last7}
          selected={window === 'last7'}
          disabled={false}
          onSelect={() => setWindow('last7')}
        />
        <Chip
          label={stats.all}
          selected={window === 'all'}
          disabled={false}
          onSelect={() => setWindow('all')}
        />
      </Row>

      <ul data-testid="attempt-bars" className="flex flex-col gap-[6px]">
        {BUCKETS.map((bucket) => {
          const count = distribution[bucket]
          return (
            <li key={bucket} className="flex items-center gap-3">
              <span className="w-[62px] shrink-0 text-[12px] text-text-faint">
                {bucket}
              </span>
              <span className="flex h-[26px] flex-1 items-center">
                {count === 0 ? (
                  <span className="text-[13px] text-text-faint">0</span>
                ) : (
                  <>
                    <span
                      style={{ flexGrow: count, flexBasis: 0 }}
                      className={`flex h-full min-w-[30px] items-center justify-end rounded-chip px-2 text-[13px] ${fillClass(bucket)}`}
                    >
                      {count}
                    </span>
                    <span
                      aria-hidden="true"
                      style={{ flexGrow: largest - count, flexBasis: 0 }}
                    />
                  </>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      <span data-testid="attempt-window-note">
        <Text tone="faint" size="sm">
          {window === 'all' ? stats.noteAll : stats.noteLast7}
        </Text>
      </span>
    </Stack>
  )
}
