'use client'

import { Select } from '@/components/controls/Select'
import { header } from '@/lib/snippets'
import { INSTRUMENT_KEYS, type InstrumentKey } from '@/lib/theory/transpose'

const OPTIONS = INSTRUMENT_KEYS.map((instrumentKey) => ({
  value: instrumentKey,
  label: header.instruments[instrumentKey],
  short: instrumentKey,
}))

type TransposeSelectProps = {
  instrumentKey: InstrumentKey
  onChange(instrumentKey: InstrumentKey): void
}

export function TransposeSelect({ instrumentKey, onChange }: TransposeSelectProps) {
  return (
    <Select
      label={header.transpose}
      value={instrumentKey}
      options={OPTIONS}
      onChange={onChange}
    />
  )
}
