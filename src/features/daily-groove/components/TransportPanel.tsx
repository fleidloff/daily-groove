import { Card } from '@/components/Card'
import { ProgressTrack } from '@/components/ProgressTrack'

type TransportPanelProps = {
  /** Position through the loop, 0..1. */
  position: number
  isPlaying: boolean
}

// Every groove is treated as a four-bar loop, so the sounding bar is the
// position quartered. The tempo is display-only and never consulted here.
const BAR_COUNT = 4

function soundingBar(position: number): number {
  const clamped = Math.min(Math.max(Number.isFinite(position) ? position : 0, 0), 1)
  return Math.min(BAR_COUNT - 1, Math.floor(clamped * BAR_COUNT))
}

/**
 * The inset panel inside the groove card: a progress bar split into four bars
 * by three markers. The sounding bar's segment is highlighted while playing;
 * when paused or stopped, no segment is highlighted.
 */
export function TransportPanel({ position, isPlaying }: TransportPanelProps) {
  const active = isPlaying ? soundingBar(position) : null

  return (
    <Card tone="inset">
      <ProgressTrack
        value={position}
        segments={BAR_COUNT}
        activeSegment={active}
      />
    </Card>
  )
}
