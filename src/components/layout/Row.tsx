import type { ReactNode } from 'react'
import type { Space } from '@/components/tokens'

type RowAlign = 'start' | 'center' | 'end' | 'baseline'
type RowJustify = 'start' | 'between' | 'end'
type RowCollapse = 'sm' | 'md'

type RowProps = {
  children: ReactNode
  gap: Space
  align?: RowAlign
  justify?: RowJustify
  collapseBelow?: RowCollapse
}

const GAP: Record<Space, string> = {
  xs: 'gap-1',
  sm: 'gap-2',
  md: 'gap-5',
  lg: 'gap-7',
  xl: 'gap-12',
}

const ALIGN: Record<RowAlign, string> = {
  start: 'items-start',
  center: 'items-center',
  end: 'items-end',
  baseline: 'items-baseline',
}

const JUSTIFY: Record<RowJustify, string> = {
  start: 'justify-start',
  between: 'justify-between',
  end: 'justify-end',
}

// Stacked is the default and the split is the override, so a narrow viewport
// never has to undo a wide-viewport layout.
const COLLAPSE: Record<RowCollapse, string> = {
  sm: 'flex-col sm:flex-row',
  md: 'flex-col md:flex-row',
}

/**
 * Horizontal flow, optionally collapsing to a single column below a named
 * breakpoint.
 */
export function Row({ children, gap, align, justify, collapseBelow }: RowProps) {
  const direction = collapseBelow ? COLLAPSE[collapseBelow] : 'flex-row'
  const className = [
    'flex',
    direction,
    GAP[gap],
    align ? ALIGN[align] : '',
    justify ? JUSTIFY[justify] : '',
  ]
    .filter(Boolean)
    .join(' ')

  return <div className={className}>{children}</div>
}
