import type { ReactNode } from 'react'

type PillProps = {
  children: ReactNode
  icon?: ReactNode
}

/** A rounded outline chip carrying a short label and an optional leading icon. */
export function Pill({ children, icon }: PillProps) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-border-strong bg-surface px-4 py-2 text-[14px] text-text">
      {icon ? (
        <span className="inline-flex items-center text-accent-soft">{icon}</span>
      ) : null}
      <span>{children}</span>
    </span>
  )
}
