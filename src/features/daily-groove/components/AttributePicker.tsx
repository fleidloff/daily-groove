'use client'

import { OptionGroup } from '@/components/OptionGroup'
import type { Attribute } from '../types'

type AttributePickerProps = {
  attribute: Attribute
  options: string[]
  value: string | null
  onSelect: (v: string) => void
  disabled?: boolean
}

const PROMPTS: Record<Attribute, string> = {
  scale: 'Which scale is this groove in?',
  chord: 'Which chord is this groove built on?',
  progression: 'Which progression does this groove follow?',
}

/**
 * Feature-specific per-attribute picker. Wraps the generic OptionGroup with
 * attribute labelling and the feature's `onSelect` naming. Works for any
 * attribute (scale, chord, progression).
 */
export function AttributePicker({
  attribute,
  options,
  value,
  onSelect,
  disabled = false,
}: AttributePickerProps) {
  return (
    <fieldset disabled={disabled}>
      <legend>{PROMPTS[attribute]}</legend>
      <OptionGroup
        name={attribute}
        options={options}
        value={value}
        onChange={onSelect}
        disabled={disabled}
      />
    </fieldset>
  )
}
