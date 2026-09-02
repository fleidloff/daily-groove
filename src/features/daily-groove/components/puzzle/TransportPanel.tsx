import { Card } from '@/components/surfaces/Card'
import { ProgressTrack } from '@/components/display/ProgressTrack'
import { Lettering } from '@/components/typography/Lettering'

type TransportPanelProps = {
  position: number
  isPlaying: boolean
  passes: number
  chords?: string[] | null
}

const BAR_COUNT = 4

const DIMMED = 'opacity-40'

function scaledPosition(position: number, passes: number): number {
  const clamped = Math.min(Math.max(Number.isFinite(position) ? position : 0, 0), 1)
  const count = Math.max(1, Number.isFinite(passes) ? passes : 1)
  return clamped * count
}

export function TransportPanel({
  position,
  isPlaying,
  passes,
  chords,
}: TransportPanelProps) {
  const scaled = scaledPosition(position, passes)
  const fill = scaled % 1
  const active = isPlaying
    ? Math.min(BAR_COUNT - 1, Math.floor(scaled * BAR_COUNT) % BAR_COUNT)
    : null

  return (
    <Card tone="inset">
      {chords && chords.length > 0 && (
        <div data-testid="chord-row" className="mb-2 grid grid-cols-4">
          {chords.map((chord, bar) => (
            <span
              key={bar}
              data-bar={bar}
              className={active !== null && bar !== active ? DIMMED : ''}
            >
              <Lettering size="sm">{chord}</Lettering>
            </span>
          ))}
        </div>
      )}
      <ProgressTrack
        value={fill}
        segments={BAR_COUNT}
        activeSegment={active}
      />
    </Card>
  )
}
