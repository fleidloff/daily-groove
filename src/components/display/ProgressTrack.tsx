type ProgressTrackProps = {
  value: number
  segments: number
  activeSegment: number | null
}

const pct = (n: number) => `${Number(n.toFixed(3))}%`

export function ProgressTrack({ value, segments, activeSegment }: ProgressTrackProps) {
  const clamped = Math.min(1, Math.max(0, Number.isFinite(value) ? value : 0))
  const percent = Math.round(clamped * 100)
  const count = Math.max(1, Math.floor(segments))
  const segmentWidth = 100 / count
  const dividers = Array.from({ length: count - 1 }, (_, i) => (i + 1) * segmentWidth)
  const active =
    activeSegment === null || activeSegment < 0 || activeSegment >= count
      ? null
      : activeSegment

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      className="relative h-2 w-full overflow-hidden rounded-full bg-border"
    >
      <svg
        aria-hidden="true"
        preserveAspectRatio="none"
        className="absolute inset-0 h-full w-full"
      >
        <rect
          data-testid="progress-fill"
          x="0"
          y="0"
          height="100%"
          width={pct(clamped * 100)}
          rx="4"
          className="fill-accent-track"
        />
        {active === null ? null : (
          <rect
            data-testid="progress-active"
            data-segment={active}
            x={pct(active * segmentWidth)}
            y="0"
            height="100%"
            width={pct(segmentWidth)}
            className="fill-warm opacity-40"
          />
        )}
        {dividers.map((left) => (
          <rect
            key={left}
            data-testid="progress-divider"
            x={pct(left)}
            y="0"
            width="1"
            height="100%"
            className="fill-surface-inset"
          />
        ))}
      </svg>
    </div>
  )
}
