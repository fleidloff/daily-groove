import type { ReactNode } from 'react'
import type { Space } from '@/components/tokens'

type StackProps = {
  children: ReactNode
  gap: Space
  fill?: boolean
}

const GAP: Record<Space, string> = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-6',
  xl: 'gap-10',
}

export function Stack({ children, gap, fill = false }: StackProps) {
  const className = ['flex flex-col', GAP[gap], fill ? 'h-full' : '']
    .filter(Boolean)
    .join(' ')
  return <div className={className}>{children}</div>
}
