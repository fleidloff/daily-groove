'use client'

import { Switch } from '@/components/controls/Switch'

type TapSoundsToggleProps = {
  on: boolean
  onChange(on: boolean): void
}

export function TapSoundsToggle({ on, onChange }: TapSoundsToggleProps) {
  return <Switch label="Tap sounds" checked={on} onChange={onChange} />
}
