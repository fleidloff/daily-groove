import type { ReactNode } from 'react'

type ContainerProps = {
  children: ReactNode
}

export function Container({ children }: ContainerProps) {
  return <div className="mx-auto w-full max-w-[1220px]">{children}</div>
}
