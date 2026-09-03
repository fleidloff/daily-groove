'use client'

import { Switch } from '@/components/controls/Switch'
import { puzzle } from '@/lib/snippets'

type ModeToggleProps = {
  simple: boolean
  onChange(simple: boolean): void
  disabled?: boolean
}

export function ModeToggle({
  simple,
  onChange,
  disabled = false,
}: ModeToggleProps) {
  return (
    <Switch
      label={puzzle.simpleMode}
      description={simple ? puzzle.simpleModeOn : puzzle.simpleModeOff}
      checked={simple}
      onChange={onChange}
      disabled={disabled}
    />
  )
}
