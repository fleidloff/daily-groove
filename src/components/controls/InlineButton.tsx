'use client'

import type { ReactNode } from 'react'

type InlineButtonProps = {
  children: ReactNode
  onPress: () => void
  label?: string
  disabled?: boolean
}

const BASE =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-control border border-border-strong bg-surface px-[13px] py-[7px] text-[14px] text-text transition-colors hover:bg-surface-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-60'

export function InlineButton({
  children,
  onPress,
  label,
  disabled = false,
}: InlineButtonProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
      className={BASE}
    >
      {children}
    </button>
  )
}
