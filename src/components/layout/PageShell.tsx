import type { ReactNode } from 'react'

type PageShellProps = {
  children: ReactNode
}

export function PageShell({ children }: PageShellProps) {
  return (
    <div className="min-h-screen px-5 pt-8 pb-12 sm:px-10 sm:pt-11 sm:pb-16">
      {children}
    </div>
  )
}
