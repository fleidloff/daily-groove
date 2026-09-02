'use client'

import { useId } from 'react'
import { Chip } from './Chip'
import { EyebrowLabel } from '@/components/typography/EyebrowLabel'

export type ChipColumns = { base: 2 | 4; wide: 4 | 6 | 7 }

type ChipGroupProps = {
  label: string
  options: string[]
  value: string | null
  onSelect: (option: string) => void
  disabled: boolean
  name: string
  columns: ChipColumns
  adornment?: string
}

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

export function ChipGroup({
  label,
  options,
  value,
  onSelect,
  disabled,
  name,
  columns,
  adornment,
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
            adornment={adornment}
          />
        ))}
      </div>
    </div>
  )
}
