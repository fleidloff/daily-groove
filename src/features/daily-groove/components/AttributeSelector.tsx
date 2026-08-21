'use client'

import type { Attribute } from '../types'

type AttributeSelectorProps = {
  selected: Attribute[]
  onToggle: (a: Attribute) => void
  disabled?: boolean
}

const ATTRIBUTES: { attribute: Attribute; label: string }[] = [
  { attribute: 'scale', label: 'Scale' },
  { attribute: 'chord', label: 'Chord' },
  { attribute: 'progression', label: 'Progression' },
]

/**
 * Lets the player opt in per attribute. Renders one toggle per attribute; only
 * checked attributes are in play for guessing.
 */
export function AttributeSelector({
  selected,
  onToggle,
  disabled = false,
}: AttributeSelectorProps) {
  return (
    <fieldset disabled={disabled}>
      <legend>Which attributes do you want to guess?</legend>
      {ATTRIBUTES.map(({ attribute, label }) => (
        <label key={attribute}>
          <input
            type="checkbox"
            name={attribute}
            checked={selected.includes(attribute)}
            disabled={disabled}
            onChange={() => onToggle(attribute)}
          />
          {label}
        </label>
      ))}
    </fieldset>
  )
}
