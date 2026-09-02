'use client'

import { Switch } from '@/components/controls/Switch'

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
      label="Simple mode"
      checked={simple}
      onChange={onChange}
      disabled={disabled}
    />
  )
}
