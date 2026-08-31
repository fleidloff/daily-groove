import { Card } from '@/components/surfaces/Card'
import { ProgressTrack } from '@/components/display/ProgressTrack'
import { Lettering } from '@/components/typography/Lettering'

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
  /**
   * One chord symbol per bar, or null to draw no row at all. Null until the
   * day has ended: the progression names the answer, so a row over the bars
   * before then would hand over the root and the mode at a glance.
   *
   * Optional, because the panel drew no row before this existed and a caller
   * that has nothing to say should not have to say `null`.
   */
  chords?: string[] | null
}

// The track always draws the four-bar figure, whatever the file's length. The
// tempo is display-only and never consulted here.
const BAR_COUNT = 4

/**
 * How a bar that is not sounding reads: the same ink, quieter. Dimming rather
 * than a second colour token is how the track's own quiet segments already
 * read, and it keeps the row on the card's ink in both palettes.
 */
const DIMMED = 'opacity-40'

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
export function TransportPanel({
  position,
  isPlaying,
  passes,
  chords,
}: TransportPanelProps) {
  const scaled = scaledPosition(position, passes)
  // The fraction of the current pass, which is the whole track.
  const fill = scaled % 1
  // `Math.min` only guards the float landing exactly on the top of a pass.
  const active = isPlaying
    ? Math.min(BAR_COUNT - 1, Math.floor(scaled * BAR_COUNT) % BAR_COUNT)
    : null

  return (
    <Card tone="inset">
      {/*
        The symbols are the feature's, not the track's: `ProgressTrack` is a
        design-system primitive and may not learn what a chord is. They align
        to the bars by sharing the track's width in four columns, so column
        `i` is bar `i` by construction and nothing measures a pixel.

        The lit symbol comes off `active` — the very value the segment
        highlight is drawn from — so the two cannot disagree at a bar line.
      */}
      {chords && chords.length > 0 && (
        <div data-testid="chord-row" className="mb-2 grid grid-cols-4">
          {chords.map((chord, bar) => (
            <span
              key={bar}
              data-bar={bar}
              // Nothing is dimmed while nothing is sounding: a stopped card
              // marks no bar, exactly as the track highlights no segment.
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
