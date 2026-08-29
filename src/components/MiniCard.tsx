import type { ReactNode } from 'react'

type MiniCardProps = {
  children: ReactNode
}

type MiniCardGridProps = {
  children: ReactNode
}

/** A small bordered surface: a compact sibling of `Card`'s raised tone. */
export function MiniCard({ children }: MiniCardProps) {
  return (
    <div className="flex flex-col gap-3 rounded-panel border border-border bg-surface px-[18px] py-4">
      {children}
    </div>
  )
}

/**
 * The grid the mini cards sit in. Narrow is the base and the six-column row is
 * the override, so a small viewport gets the reflowed layout by default rather
 * than having to undo a wide one.
 */
export function MiniCardGrid({ children }: MiniCardGridProps) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {children}
    </div>
  )
}
