import { Card } from '@/components/surfaces/Card'
import { ProgressTrack } from '@/components/display/ProgressTrack'

type TransportPanelProps = {
  /** Position through the whole loop, 0..1. */
  position: number
  isPlaying: boolean
  /**
   * How many passes of the four-bar figure the loop is made of. At least 1,
   * where 1 is a file that is exactly its figure. Required rather than
   * defaulted: a caller that forgets it should fail at the type level, not
   * silently draw a fill running at a quarter speed.
   */
  passes: number
}

// The track always draws the four-bar figure, whatever the file's length. The
// tempo is display-only and never consulted here.
const BAR_COUNT = 4

/**
 * Position expressed in passes: 0..1 over the file becomes 0..`passes`, so the
 * whole number is the pass that is sounding and the fraction is how far through
 * it we are.
 *
 * Both numbers below come off this one value. Deriving them separately is what
 * would let the fill reset a frame before or after the highlight steps back to
 * bar one, and a boundary is exactly where a player is looking.
 */
function scaledPosition(position: number, passes: number): number {
  const clamped = Math.min(Math.max(Number.isFinite(position) ? position : 0, 0), 1)
  const count = Math.max(1, Number.isFinite(passes) ? passes : 1)
  return clamped * count
}

/**
 * The inset panel inside the groove card: a progress bar split into four bars
 * by three markers. The sounding bar's segment is highlighted while playing;
 * when paused or stopped, no segment is highlighted.
 *
 * Nothing here names or counts the pass. A player sees a four-bar loop and
 * hears a longer one, which is the point — the highlight already moves, and
 * the repeat is meant to be felt rather than read off a counter.
 */
export function TransportPanel({ position, isPlaying, passes }: TransportPanelProps) {
  const scaled = scaledPosition(position, passes)
  // The fraction of the current pass, which is the whole track.
  const fill = scaled % 1
  // `Math.min` only guards the float landing exactly on the top of a pass.
  const active = isPlaying
    ? Math.min(BAR_COUNT - 1, Math.floor(scaled * BAR_COUNT) % BAR_COUNT)
    : null

  return (
    <Card tone="inset">
      <ProgressTrack
        value={fill}
        segments={BAR_COUNT}
        activeSegment={active}
      />
    </Card>
  )
}
