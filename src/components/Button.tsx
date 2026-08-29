'use client'

import type { ReactNode } from 'react'

type ButtonTone = 'idle' | 'ready' | 'solved'

type ButtonProps = {
  children: ReactNode
  onPress: () => void
  disabled: boolean
  tone: ButtonTone
}

const BASE =
  'w-full cursor-pointer rounded-control px-4 py-[15px] text-center text-[15px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-default'

const TONE: Record<ButtonTone, string> = {
  idle: 'bg-surface-inset text-text-faint',
  ready: 'bg-accent text-paper-tint hover:bg-accent-hover',
  solved: 'bg-accent-soft text-paper-tint',
}

/**
 * The full-width call to action. `idle` is the waiting state, `ready` the
 * live one, `solved` the finished one.
 */
export function Button({ children, onPress, disabled, tone }: ButtonProps) {
  return (
    <button
      type="button"
      onClick={onPress}
      disabled={disabled}
      className={`${BASE} ${TONE[tone]}`}
    >
      {children}
    </button>
  )
}
