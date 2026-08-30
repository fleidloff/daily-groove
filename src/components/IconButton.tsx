'use client'

import type { ReactNode } from 'react'

type IconButtonProps = {
  onPress: () => void
  label: string
  glyph: ReactNode
  /** Renders the control inert. Defaults to enabled. */
  disabled?: boolean
}

const CLASS =
  'flex h-[52px] w-[52px] shrink-0 cursor-pointer items-center justify-center rounded-full bg-accent text-[15px] text-paper-tint transition-colors hover:bg-accent-hover disabled:cursor-default disabled:opacity-60 disabled:hover:bg-accent'

/**
 * A circular accent control. The glyph is decorative, so the accessible name
 * comes from `label` alone.
 */
export function IconButton({ onPress, label, glyph, disabled = false }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
      className={CLASS}
    >
      <span aria-hidden="true" className="leading-none">
        {glyph}
      </span>
    </button>
  )
}
