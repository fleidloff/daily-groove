'use client'

import { useMemo, useState } from 'react'
import type { Groove } from '../../types'
import { isoDate, nextDayStart } from '@/lib/date'
import { loopSecondsOf } from '@/lib/theory/music'
import { LICK_VARIATIONS } from '@/lib/theory/licks'
import { GROOVES } from '../../data/grooves.generated'
import { PITCHES } from '../../data/notes.generated'
import { selectGrooveForDate } from '../../lib/puzzle/selectGroove'
import type { GrooveClock } from '../../lib/audio/beat'
import { REFERENCE_FADE_SECONDS, REFERENCE_LEVEL } from '../../lib/audio/level'
import { referenceOutput } from '../../lib/audio/output'
import type { PlayableSource } from '../../lib/audio/transport'
import { useModeLick } from '../../hooks/useModeLick'
import { useTransport } from '../../hooks/useTransport'
import { Button } from '@/components/controls/Button'
import { Chip } from '@/components/controls/Chip'
import { PlayControl } from '@/components/controls/PlayControl'
import { Card } from '@/components/surfaces/Card'
import { Row } from '@/components/layout/Row'
import { Stack } from '@/components/layout/Stack'
import { Heading } from '@/components/typography/Heading'
import { Text } from '@/components/typography/Text'

type Day = { iso: string; groove: Groove }

const PLAY_TEXT = { play: 'Play', stop: 'Stop', loading: 'Loading' }
const PLAY_NAME = { play: 'Play groove', stop: 'Stop groove' }

function scheduleFrom(start: Date): Day[] {
  const days: Day[] = []
  const seen = new Set<string>()
  const cap = 2 * GROOVES.length
  let date = start

  while (days.length < cap && seen.size < GROOVES.length) {
    const groove = selectGrooveForDate(date, GROOVES)
    days.push({ iso: isoDate(date), groove })
    seen.add(groove.uuid)
    date = nextDayStart(date)
  }

  return days
}

function rowLabel({ iso, groove }: Day): string {
  return [
    iso,
    groove.name,
    groove.scale,
    groove.chord,
    groove.progression,
    `${groove.bpm} bpm`,
  ].join(' · ')
}

function LickButton({
  groove,
  clock,
  variation,
}: {
  groove: Groove
  clock: GrooveClock
  variation: number
}) {
  const { playMode } = useModeLick({
    pitches: PITCHES,
    root: groove.root,
    bpm: groove.bpm,
    clock,
    level: REFERENCE_LEVEL,
    fadeSeconds: REFERENCE_FADE_SECONDS,
    output: referenceOutput(),
    variation,
  })

  const label = `Lick ${variation + 1}`

  return (
    <Button
      tone="idle"
      disabled={false}
      label={label}
      onPress={() => playMode(groove.flavour)}
    >
      {label}
    </Button>
  )
}

function GroovePlayer({ groove }: { groove: Groove }) {
  const source = useMemo<PlayableSource>(
    () => ({
      src: groove.audioSrc,
      loopSeconds: loopSecondsOf(groove),
      headDelaySeconds: groove.headDelaySeconds,
    }),
    [groove],
  )

  const { isPlaying, loading, toggle, clock } = useTransport(source, groove.bpm)

  return (
    <Card tone="inset">
      <Stack gap="md">
        <PlayControl
          isPlaying={isPlaying}
          onToggle={() => {
            void toggle()
          }}
          busy={loading}
          text={PLAY_TEXT}
          name={PLAY_NAME}
        />
        <Row gap="sm">
          {Array.from({ length: LICK_VARIATIONS }, (_, variation) => (
            <LickButton
              key={variation}
              groove={groove}
              clock={clock}
              variation={variation}
            />
          ))}
        </Row>
      </Stack>
    </Card>
  )
}

export function GroovePreview({ today }: { today?: Date }) {
  const [start] = useState(() => today ?? new Date())
  const days = useMemo(() => scheduleFrom(start), [start])
  const [picked, setPicked] = useState<string | null>(null)

  return (
    <Stack gap="lg">
      <Stack gap="sm">
        <Heading level={1} size="lg">
          Groove preview
        </Heading>
        <Text tone="muted">
          Every groove in the catalogue, from today until each one has come up.
        </Text>
      </Stack>
      <ul>
        {days.map((day) => (
          <li key={day.iso}>
            <Stack gap="sm">
              <Chip
                label={rowLabel(day)}
                selected={picked === day.iso}
                disabled={false}
                onSelect={() => setPicked(day.iso)}
              />
              {picked === day.iso && (
                <GroovePlayer key={day.iso} groove={day.groove} />
              )}
            </Stack>
          </li>
        ))}
      </ul>
    </Stack>
  )
}
