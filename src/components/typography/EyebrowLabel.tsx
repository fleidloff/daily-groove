import type { ReactNode } from 'react'

type EyebrowLabelProps = {
  children: ReactNode
}

/** The small uppercase, letter-spaced label that sits above a group. */
export function EyebrowLabel({ children }: EyebrowLabelProps) {
  return (
    <span className="block text-[11px] uppercase tracking-[0.14em] text-text-faint">
      {children}
    </span>
  )
}
