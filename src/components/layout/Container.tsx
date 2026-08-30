import type { ReactNode } from 'react'

type ContainerProps = {
  children: ReactNode
}

/** Centres page content on a bounded measure. */
export function Container({ children }: ContainerProps) {
  return <div className="mx-auto w-full max-w-[1220px]">{children}</div>
}
