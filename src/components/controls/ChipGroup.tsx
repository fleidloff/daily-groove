'use client'

import { useId } from 'react'
import { Chip } from './Chip'
import { EyebrowLabel } from '@/components/typography/EyebrowLabel'

/** Columns at the base width, and above the `md` breakpoint. */
export type ChipColumns = { base: 2 | 4; wide: 4 | 6 | 7 }

type ChipGroupProps = {
  label: string
  options: string[]
  value: string | null
  onSelect: (option: string) => void
  disabled: boolean
  name: string
  columns: ChipColumns
}

// Tailwind's JIT only sees literal class strings, so the column count maps
// through a lookup rather than being interpolated into `grid-cols-${n}`.
// `ChipColumns` is a union of the counts in use, so a count with no class here
// is a type error rather than a silently missing class.
const COLUMN_CLASS: Record<number, string> = {
  2: 'grid-cols-2',
  4: 'grid-cols-4',
  6: 'grid-cols-6',
  7: 'grid-cols-7',
}

const WIDE_CLASS: Record<number, string> = {
  4: 'md:grid-cols-4',
  6: 'md:grid-cols-6',
  7: 'md:grid-cols-7',
}

/**
 * A labelled single-select row of chips. Only `value` reads as pressed, so
 * choosing another option replaces the selection rather than adding to it.
 *
 * The chips sit on a grid of equal columns, so the row spreads across its
 * container and a trailing short row leaves empty cells instead of stretching.
 * `columns` carries counts, not row names: the caller is what knows how many
 * options it has, and a group that had learned what its rows mean would have
 * stopped being a primitive.
 */
export function ChipGroup({
  label,
  options,
  value,
  onSelect,
  disabled,
  name,
  columns,
}: ChipGroupProps) {
  const labelId = useId()
  const layout = `grid ${COLUMN_CLASS[columns.base]} ${WIDE_CLASS[columns.wide]} gap-[7px]`

  return (
    <div role="radiogroup" aria-labelledby={labelId}>
      <span id={labelId}>
        <EyebrowLabel>{label}</EyebrowLabel>
      </span>
      <div data-testid="chip-list" className={`mt-[10px] ${layout}`}>
        {options.map((option) => (
          <Chip
            key={`${name}-${option}`}
            label={option}
            selected={value === option}
            disabled={disabled}
            onSelect={() => onSelect(option)}
          />
        ))}
      </div>
    </div>
  )
}
