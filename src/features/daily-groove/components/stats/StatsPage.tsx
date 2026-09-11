'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { Chip } from '@/components/controls/Chip'
import { Button } from '@/components/controls/Button'
import { Row } from '@/components/layout/Row'
import { Stack } from '@/components/layout/Stack'
import { Card } from '@/components/surfaces/Card'
import { Heading } from '@/components/typography/Heading'
import { SectionLabel } from '@/components/typography/SectionLabel'
import { Text } from '@/components/typography/Text'
import type { Stats } from '../../lib/stats/types'
import { createLocalStore } from '../../lib/persistence/storage'
import { isoDate } from '@/lib/date'
import { AttemptBars, BUCKETS } from './AttemptBars'
import { stats } from '@/lib/snippets'

const STATS_ROUTE = '/api/stats'

type View =
  | { kind: 'loading' }
  | { kind: 'ready'; stats: Stats }
  | { kind: 'failed' }
  | { kind: 'empty' }

function dayOneLine(data: Stats): string {
  const bucket = BUCKETS.find((candidate) => data.attempts.all[candidate] > 0)
  if (bucket === undefined || bucket === 'revealed') return stats.dayOneRevealed
  return stats.dayOneSolved({ guesses: bucket })
}

function SkeletonBlock({ className }: { className: string }) {
  return (
    <span
      aria-hidden="true"
      className={`block rounded-panel bg-surface-inset ${className}`}
    />
  )
}

function StatsSkeleton() {
  return (
    <div data-testid="stats-skeleton">
      <Stack gap="lg">
        <Card>
          <Stack gap="lg">
            <Stack gap="md">
              <SectionLabel>{stats.playedLabel}</SectionLabel>
              <SkeletonBlock className="h-[44px] w-[120px]" />
            </Stack>
            <Row gap="xl">
              <Stack gap="xs">
                <SkeletonBlock className="h-[32px] w-[56px]" />
                <Text tone="faint" size="sm">
                  {stats.streak}
                </Text>
              </Stack>
              <Stack gap="xs">
                <SkeletonBlock className="h-[32px] w-[56px]" />
                <Text tone="faint" size="sm">
                  {stats.solved}
                </Text>
              </Stack>
              <Stack gap="xs">
                <SkeletonBlock className="h-[32px] w-[56px]" />
                <Text tone="faint" size="sm">
                  {stats.revealed}
                </Text>
              </Stack>
            </Row>
          </Stack>
        </Card>

        <Card>
          <Stack gap="md">
            <SectionLabel>{stats.attemptsLabel}</SectionLabel>
            <Row gap="sm">
              <Chip label={stats.last7} selected={false} disabled onSelect={() => {}} />
              <Chip label={stats.all} selected disabled onSelect={() => {}} />
            </Row>
            <div className="flex flex-col gap-[6px]">
              {BUCKETS.map((bucket, index) => (
                <div key={bucket} className="flex items-center gap-3">
                  <span className="w-[62px] shrink-0 text-[12px] text-text-faint">
                    {bucket}
                  </span>
                  <SkeletonBlock
                    className={`h-[26px] ${['w-2/5', 'w-3/5', 'w-4/5', 'w-1/2', 'w-1/3', 'w-1/4', 'w-2/5'][index]}`}
                  />
                </div>
              ))}
            </div>
          </Stack>
        </Card>
      </Stack>
    </div>
  )
}

function FullStats({ data }: { data: Stats }) {
  return (
    <Stack gap="lg">
      <Card>
        <Stack gap="lg">
          <Stack gap="md">
            <SectionLabel>{stats.playedLabel}</SectionLabel>
            <div data-testid="puzzles-played" className="flex items-baseline gap-2">
              <span className="font-display text-[38px] leading-none text-text">
                {data.puzzlesPlayed}
              </span>
              <span className="text-[13px] text-text-faint">{stats.playedUnit}</span>
            </div>
          </Stack>

          <div data-testid="solved-revealed">
            <Row gap="xl">
              <Stack gap="xs">
                <span
                  data-testid="streak-count"
                  className="font-display text-[30px] leading-none text-text"
                >
                  {data.streak}
                </span>
                <Text tone="faint" size="sm">
                  {stats.streak}
                </Text>
              </Stack>
              <Stack gap="xs">
                <span
                  data-testid="solved-count"
                  className="font-display text-[30px] leading-none text-text"
                >
                  {data.solved}
                </span>
                <Text tone="faint" size="sm">
                  {stats.solved}
                </Text>
              </Stack>
              <Stack gap="xs">
                <span
                  data-testid="revealed-count"
                  className="font-display text-[30px] leading-none text-text"
                >
                  {data.revealed}
                </span>
                <Text tone="faint" size="sm">
                  {stats.revealed}
                </Text>
              </Stack>
            </Row>
          </div>
        </Stack>
      </Card>

      <Card>
        <AttemptBars attempts={data.attempts} />
      </Card>
    </Stack>
  )
}

export function StatsPage() {
  const [view, setView] = useState<View>({ kind: 'loading' })

  const resolveView = useCallback(async (): Promise<View> => {
    const results = await createLocalStore().getAll()
    if (results.length === 0) return { kind: 'empty' }

    try {
      const response = await fetch(STATS_ROUTE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results, today: isoDate(new Date()) }),
      })
      if (!response.ok) return { kind: 'failed' }
      return { kind: 'ready', stats: (await response.json()) as Stats }
    } catch {
      return { kind: 'failed' }
    }
  }, [])

  useEffect(() => {
    let active = true
    resolveView().then((next) => {
      if (active) setView(next)
    })
    return () => {
      active = false
    }
  }, [resolveView])

  const showsSubtitle =
    view.kind === 'loading' || (view.kind === 'ready' && view.stats.puzzlesPlayed > 1)

  return (
    <div className="mx-auto w-full max-w-[620px]">
      <Stack gap="lg">
        <Text tone="muted" size="sm">
          <Link href="/">{stats.back}</Link>
        </Text>

        <Stack gap="sm">
          <Heading level={1} size="lg">
            {stats.title}
          </Heading>
          {showsSubtitle ? <Text tone="muted">{stats.subtitle}</Text> : null}
        </Stack>

        {view.kind === 'loading' ? <StatsSkeleton /> : null}

        {view.kind === 'failed' ? (
          <Card tone="inset">
            <div data-testid="stats-failed">
              <Stack gap="md" align="start">
                <Text tone="muted">{stats.failed}</Text>
                <Button
                  onPress={() => {
                    setView({ kind: 'loading' })
                    void resolveView().then(setView)
                  }}
                  disabled={false}
                  tone="ready"
                >
                  {stats.retry}
                </Button>
              </Stack>
            </div>
          </Card>
        ) : null}

        {view.kind === 'empty' ? (
          <Card tone="inset">
            <div data-testid="stats-empty">
              <Stack gap="sm">
                <Text>{stats.empty}</Text>
                <Text tone="muted">{stats.emptyHint}</Text>
              </Stack>
            </div>
          </Card>
        ) : null}

        {view.kind === 'ready' && view.stats.puzzlesPlayed === 1 ? (
          <Card tone="inset">
            <div data-testid="stats-day-one">
              <Text>{dayOneLine(view.stats)}</Text>
            </div>
          </Card>
        ) : null}

        {view.kind === 'ready' && view.stats.puzzlesPlayed !== 1 ? (
          <FullStats data={view.stats} />
        ) : null}
      </Stack>
    </div>
  )
}
