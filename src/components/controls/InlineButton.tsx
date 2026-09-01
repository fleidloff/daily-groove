'use client'

import type { ReactNode } from 'react'

type InlineButtonProps = {
  children: ReactNode
  onPress: () => void
  /** Sets aria-label. Without it the accessible name stays the children. */
  label?: string
  disabled?: boolean
}

// Deliberately not `w-full`: this control hugs its label so it can sit inline
// beside other page furniture. The radius, the focus ring and the disabled
// treatment are the system's own, so it reads as a smaller sibling of `Button`
// rather than a one-off — the geometry is all that differs.
const BASE =
  'inline-flex cursor-pointer items-center justify-center gap-2 rounded-control border border-border-strong bg-surface px-[13px] py-[7px] text-[14px] text-text transition-colors hover:bg-surface-inset focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default disabled:opacity-60'

/**
 * A compact action. Where `Button` is the full-width call to action that owns
 * the bottom of a card, this one is the small press that sits in a line of
 * other things — a header, a toolbar, the end of a row.
 *
 * It holds no state and takes no width: whether it is disabled, and what it
 * says, are the caller's to decide, and the row it sits in decides where it
 * goes. Anything transient a press leads to — a confirmation, a countdown —
 * belongs to the caller too; a button that owns a timer hands that timer to
 * everyone who ever renders it.
 */
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
