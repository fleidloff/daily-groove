'use client'

import type { ReactNode } from 'react'

type ButtonTone = 'idle' | 'ready' | 'solved'

type ButtonSize = 'md' | 'lg'

type ButtonProps = {
  children: ReactNode
  onPress: () => void
  disabled: boolean
  tone: ButtonTone
  /** Sets aria-label. Without it the accessible name stays the children. */
  label?: string
  /** How much room the button takes. Defaults to `md`. */
  size?: ButtonSize
}

const BASE =
  'w-full cursor-pointer rounded-control px-4 text-center transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default'

const SIZE: Record<ButtonSize, string> = {
  md: 'py-[15px] text-[15px]',
  lg: 'py-[22px] text-[17px]',
}

const TONE: Record<ButtonTone, string> = {
  idle: 'bg-surface-inset text-text-faint',
  ready: 'bg-accent text-paper-tint hover:bg-accent-hover',
  solved: 'bg-accent-soft text-paper-tint',
}

/**
 * The full-width call to action. `idle` is the waiting state, `ready` the
 * live one, `solved` the finished one. `size` sets how much room it takes;
 * the two sizes differ in vertical padding and type size and in nothing else.
 */
export function Button({
  children,
  onPress,
  disabled,
  tone,
  label,
  size = 'md',
}: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      aria-label={label}
      className={`${BASE} ${SIZE[size]} ${TONE[tone]}`}
    >
      {children}
    </button>
  )
}
