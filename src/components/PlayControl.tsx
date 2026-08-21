'use client'

type PlayControlProps = {
  onPlay: () => void
  isPlaying: boolean
  label?: string
}

/**
 * Generic design-system play/replay button. Prop-driven and free of any feature
 * or domain knowledge.
 */
export function PlayControl({ onPlay, isPlaying, label }: PlayControlProps) {
  const text = label ?? (isPlaying ? 'Replay' : 'Play')

  return (
    <button type="button" onClick={onPlay} aria-pressed={isPlaying}>
      {text}
    </button>
  )
}
