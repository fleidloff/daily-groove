import { Card } from '@/components/Card'
import { ProgressTrack } from '@/components/ProgressTrack'
import { Row } from '@/components/Row'
import { Stack } from '@/components/Stack'

type TransportPanelProps = {
  /** Position through the loop, 0..1. */
  position: number
  isPlaying: boolean
}

// Every groove is treated as a four-bar loop, so the sounding bar is the
// position quartered. The tempo is display-only and never consulted here.
const BAR_COUNT = 4
const BARS = Array.from({ length: BAR_COUNT }, (_, index) => index)

function soundingBar(position: number): number {
  const clamped = Math.min(Math.max(Number.isFinite(position) ? position : 0, 0), 1)
  return Math.min(BAR_COUNT - 1, Math.floor(clamped * BAR_COUNT))
}

/**
 * The inset panel inside the groove card: a progress bar split into four bars
 * by three markers, with a label per bar. The label of the sounding bar is
 * highlighted while playing; when paused or stopped, no bar is highlighted.
 */
export function TransportPanel({ position, isPlaying }: TransportPanelProps) {
  const active = isPlaying ? soundingBar(position) : null

  return (
    <Card tone="inset">
      <Stack gap="md">
        <ProgressTrack
          value={position}
          segments={BAR_COUNT}
          activeSegment={active}
        />
        <Row gap="sm" justify="between">
          {BARS.map((index) => (
            <span
              key={index}
              aria-current={active === index ? 'true' : undefined}
              className={`text-[11px] tracking-[0.1em] ${
                active === index ? 'text-warm' : 'text-text-faint'
              }`}
            >
              {`BAR ${index + 1}`}
            </span>
          ))}
        </Row>
      </Stack>
    </Card>
  )
}
