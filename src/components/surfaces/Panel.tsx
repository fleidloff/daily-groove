import type { ReactNode } from 'react'

type PanelProps = {
  children: ReactNode
}

type PanelColumnsProps = {
  children: ReactNode
}

export function Panel({ children }: PanelProps) {
  return (
    <section className="w-full rounded-card bg-accent bg-linear-160 from-accent to-accent-hover px-6 py-7 text-on-accent sm:px-10 sm:py-9">
      {children}
    </section>
  )
}

export function PanelColumns({ children }: PanelColumnsProps) {
  return (
    <div className="grid grid-cols-1 gap-7 sm:gap-9 md:grid-cols-2">{children}</div>
  )
}
