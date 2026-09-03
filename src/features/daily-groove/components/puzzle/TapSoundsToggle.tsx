'use client'

import { Switch } from '@/components/controls/Switch'
import { puzzle } from '@/lib/snippets'

type TapSoundsToggleProps = {
  on: boolean
  onChange(on: boolean): void
}

export function TapSoundsToggle({ on, onChange }: TapSoundsToggleProps) {
  return <Switch label={puzzle.tapSounds} checked={on} onChange={onChange} />
}
