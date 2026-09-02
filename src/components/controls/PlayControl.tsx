'use client'

import { Button } from './Button'

type PlayControlProps = {
  isPlaying: boolean
  onToggle: () => void
  busy?: boolean
  text?: { play: string; stop: string; loading: string }
}

const GLYPH = { play: '▶', stop: '■', loading: '◌' } as const
const TEXT = { play: 'Play', stop: 'Stop', loading: 'Loading…' } as const
const NAME = { play: 'Play the loop', stop: 'Stop the loop' } as const

export function PlayControl({ isPlaying, onToggle, busy = false, text = TEXT }: PlayControlProps) {
  const action = isPlaying ? 'stop' : 'play'
  const state = busy ? 'loading' : action

  return (
    <Button
      tone="ready"
      size="lg"
      disabled={busy}
      onPress={onToggle}
      label={busy ? text.loading : NAME[action]}
    >
      {`${GLYPH[state]} ${text[state]}`}
    </Button>
  )
}
