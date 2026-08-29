'use client'

import { IconButton } from './IconButton'

type PlayControlProps = {
  isPlaying: boolean
  onToggle: () => void
}

/**
 * The loop transport toggle. Its accessible name states the action the press
 * will perform, not the state it is in.
 */
export function PlayControl({ isPlaying, onToggle }: PlayControlProps) {
  return (
    <IconButton
      onPress={onToggle}
      label={isPlaying ? 'Pause the loop' : 'Play the loop'}
      glyph={isPlaying ? '■' : '▶'}
    />
  )
}
