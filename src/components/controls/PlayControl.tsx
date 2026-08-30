'use client'

import { Button } from './Button'

type PlayControlProps = {
  isPlaying: boolean
  onToggle: () => void
  /** Inert, showing the loading word, until audio starts. */
  busy?: boolean
  /**
   * Visible words for the three states. Defaults to the generic set: naming
   * what is being played, or loaded, is the caller's business, not the design
   * system's.
   */
  text?: { play: string; stop: string; loading: string }
}

/** Glyph and word swap together, so they live side by side. */
const GLYPH = { play: '▶', stop: '■', loading: '◌' } as const
const TEXT = { play: 'Play', stop: 'Stop', loading: 'Loading…' } as const
const NAME = { play: 'Play the loop', stop: 'Stop the loop' } as const

/**
 * The loop transport toggle. Its accessible name states the action the press
 * will perform, not the state it is in — except while `busy`, where there is
 * no action to offer and the name reports the wait instead.
 *
 * `busy` is a prop, never state: it lasts exactly as long as the caller says
 * it does, and clearing it returns the control to the state `isPlaying` names.
 *
 * It renders `Button`, inheriting the solve button's geometry rather than
 * restating it. There is one page and one loop, so there is one form.
 */
export function PlayControl({ isPlaying, onToggle, busy = false, text = TEXT }: PlayControlProps) {
  const action = isPlaying ? 'stop' : 'play'
  const state = busy ? 'loading' : action

  return (
    <Button
      tone="ready"
      disabled={busy}
      onPress={onToggle}
      label={busy ? text.loading : NAME[action]}
    >
      {`${GLYPH[state]} ${text[state]}`}
    </Button>
  )
}
