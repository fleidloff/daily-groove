import type { ReactNode } from 'react'

type CardTone = 'raised' | 'inset'

type CardProps = {
  children: ReactNode
  tone?: CardTone
}

const TONE: Record<CardTone, string> = {
  raised:
    'rounded-card border border-border bg-surface p-6 shadow-card sm:p-8',
  inset: 'rounded-panel border border-border bg-surface-inset p-5 sm:p-6',
}

/**
 * A surface panel. `raised` is the cream card that floats off the paper;
 * `inset` is the recessed panel that sits inside one.
 */
export function Card({ children, tone = 'raised' }: CardProps) {
  return <div className={TONE[tone]}>{children}</div>
}
