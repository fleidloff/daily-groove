'use client'

import { Select } from '@/components/controls/Select'
import { header } from '@/lib/snippets'
import { WRITTEN, type Written } from '@/lib/theory/transpose'

const OPTIONS = WRITTEN.map((written) => ({
  value: written,
  label: header.instruments[written],
  short: written,
}))

type TransposeSelectProps = {
  written: Written
  onChange(written: Written): void
}

export function TransposeSelect({ written, onChange }: TransposeSelectProps) {
  return (
    <Select
      label={header.transpose}
      value={written}
      options={OPTIONS}
      onChange={onChange}
    />
  )
}
