import type { ReactNode } from 'react'
import type { Space } from '@/components/tokens'

type StackAlign = 'start' | 'center' | 'end'

type StackProps = {
  children: ReactNode
  gap: Space
  align?: StackAlign
  fill?: boolean
}

const GAP: Record<Space, string> = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-3',
  lg: 'gap-6',
  xl: 'gap-10',
}

const ALIGN: Record<StackAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
}

export function Stack({ children, gap, align, fill = false }: StackProps) {
  const className = [
    'flex flex-col',
    GAP[gap],
    align ? ALIGN[align] : '',
    fill ? 'h-full' : '',
  ]
    .filter(Boolean)
    .join(' ')
  return <div className={className}>{children}</div>
}
