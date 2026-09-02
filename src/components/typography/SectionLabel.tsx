import type { ReactNode } from 'react'
import { EyebrowLabel } from './EyebrowLabel'

type SectionLabelProps = {
  children: ReactNode
  action?: ReactNode
}

export function SectionLabel({ children, action }: SectionLabelProps) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <EyebrowLabel>{children}</EyebrowLabel>
      {action ? <span className="shrink-0 text-[14px]">{action}</span> : null}
    </div>
  )
}
