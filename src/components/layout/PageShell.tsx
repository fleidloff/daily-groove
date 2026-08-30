import type { ReactNode } from 'react'

type PageShellProps = {
  children: ReactNode
}

/**
 * The outermost frame of a page: the full-height ground and the page padding.
 * Children-only — every structural decision lives here rather than at the call
 * site.
 */
export function PageShell({ children }: PageShellProps) {
  return (
    <div className="min-h-screen px-5 pt-8 pb-12 sm:px-10 sm:pt-11 sm:pb-16">
      {children}
    </div>
  )
}
