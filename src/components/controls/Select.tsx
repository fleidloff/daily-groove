'use client'

import { useId } from 'react'

type SelectProps<T extends string> = {
  label: string
  value: T
  options: readonly { value: T; label: string; short?: string }[]
  onChange(value: T): void
  disabled?: boolean
}

const WRAP =
  'relative inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-4 py-2 text-[14px] text-text has-[select:disabled]:opacity-60 has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-accent'

const FIELD =
  'absolute inset-0 cursor-pointer appearance-none opacity-0 outline-none disabled:cursor-default'

export function Select<T extends string>({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: SelectProps<T>) {
  const labelId = useId()
  const current = options.find((option) => option.value === value)

  return (
    <span className={WRAP}>
      <select
        aria-labelledby={labelId}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as T)}
        className={FIELD}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <span id={labelId} className="pointer-events-none text-text-muted">
        {label}
      </span>
      <span className="pointer-events-none">
        {current?.short ?? current?.label}
      </span>
      <svg
        aria-hidden="true"
        focusable="false"
        viewBox="0 0 12 12"
        width="12"
        height="12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none text-text-faint"
      >
        <path d="M2.5 4.75 6 8.25l3.5-3.5" />
      </svg>
    </span>
  )
}
