'use client'

import { Button } from './Button'
import { IconButton } from './IconButton'

export type PlayControlSize = 'sm' | 'lg'

type PlayControlProps = {
  isPlaying: boolean
  onToggle: () => void
  /** 'sm' is the circular control; 'lg' is the full-width one. Defaults to 'sm'. */
  size?: PlayControlSize
  /** Overrides the accessible name. Falls back to "Play/Stop the loop". */
  label?: string
  /** Renders the control inert, for a source that cannot be played. */
  disabled?: boolean
  /**
   * Visible words for the two states. Defaults to the generic pair: naming
   * what is being played is the caller's business, not the design system's.
   */
  text?: { play: string; stop: string }
}

/** Glyph and word swap together, so they live side by side. */
const GLYPH = { play: '▶', stop: '■' } as const
const TEXT = { play: 'Play', stop: 'Stop' } as const
const NAME = { play: 'Play the loop', stop: 'Stop the loop' } as const

/**
 * The loop transport toggle. Its accessible name states the action the press
 * will perform, not the state it is in — unless a caller overrides it with
 * `label`, which several controls in a row need to stay distinguishable.
 *
 * The size picks the host primitive: `'lg'` renders `Button`, inheriting the
 * solve button's geometry rather than restating it; `'sm'` renders the
 * circular `IconButton`.
 */
export function PlayControl({
  isPlaying,
  onToggle,
  size = 'sm',
  label,
  disabled = false,
  text = TEXT,
}: PlayControlProps) {
  const state = isPlaying ? 'stop' : 'play'
  const name = label ?? NAME[state]

  if (size === 'lg') {
    return (
      <Button tone="ready" disabled={disabled} onPress={onToggle} label={name}>
        {`${GLYPH[state]} ${text[state]}`}
      </Button>
    )
  }

  return (
    <IconButton onPress={onToggle} label={name} glyph={GLYPH[state]} disabled={disabled} />
  )
}
