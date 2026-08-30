import type { ReactNode } from 'react'
import type { Space } from '@/components/tokens'

type StackProps = {
  children: ReactNode
  gap: Space
}

const GAP: Record<Space, string> = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-6',
  xl: 'gap-10',
}

/** Vertical flow. Spacing comes from the token scale, never from the caller. */
export function Stack({ children, gap }: StackProps) {
  return <div className={`flex flex-col ${GAP[gap]}`}>{children}</div>
}
