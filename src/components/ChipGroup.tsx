'use client'

import { useId } from 'react'
import { Chip } from './Chip'
import { EyebrowLabel } from './EyebrowLabel'

type ChipWidth = 'auto' | 'fixed'

type ChipGroupProps = {
  label: string
  options: string[]
  value: string | null
  onSelect: (option: string) => void
  disabled: boolean
  name: string
  width?: ChipWidth
}

/**
 * A labelled single-select row of chips. Only `value` reads as pressed, so
 * choosing another option replaces the selection rather than adding to it.
 * The row wraps, so a narrow viewport reflows instead of overflowing.
 * `width` is passed straight through to every chip, so a group of short,
 * equal-length labels can line up on a common width.
 */
export function ChipGroup({
  label,
  options,
  value,
  onSelect,
  disabled,
  name,
  width = 'auto',
}: ChipGroupProps) {
  const labelId = useId()

  return (
    <div role="radiogroup" aria-labelledby={labelId}>
      <span id={labelId}>
        <EyebrowLabel>{label}</EyebrowLabel>
      </span>
      <div data-testid="chip-list" className="mt-[10px] flex flex-wrap gap-[7px]">
        {options.map((option) => (
          <Chip
            key={`${name}-${option}`}
            label={option}
            selected={value === option}
            disabled={disabled}
            onSelect={() => onSelect(option)}
            width={width}
          />
        ))}
      </div>
    </div>
  )
}
