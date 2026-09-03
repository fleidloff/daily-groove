'use client'

import { Button } from './Button'

type PlayControlProps = {
  isPlaying: boolean
  onToggle: () => void
  busy?: boolean
  text: { play: string; stop: string; loading: string }
  name: { play: string; stop: string }
}

const GLYPH = { play: '▶', stop: '■', loading: '◌' } as const

export function PlayControl({ isPlaying, onToggle, busy = false, text, name }: PlayControlProps) {
  const action = isPlaying ? 'stop' : 'play'
  const state = busy ? 'loading' : action

  return (
    <Button
      tone="ready"
      size="lg"
      disabled={busy}
      onPress={onToggle}
      label={busy ? text.loading : name[action]}
    >
      {`${GLYPH[state]} ${text[state]}`}
    </Button>
  )
}
