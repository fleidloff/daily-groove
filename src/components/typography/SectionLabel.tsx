import type { ReactNode } from 'react'
import { EyebrowLabel } from './EyebrowLabel'

type SectionLabelProps = {
  children: ReactNode
  action?: ReactNode
}

/**
 * A section heading in eyebrow form, with an optional node — a link, a count —
 * pushed to the far side of the row. With no action the row still holds the
 * label alone, so a section can gain one later without a layout change.
 */
export function SectionLabel({ children, action }: SectionLabelProps) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <EyebrowLabel>{children}</EyebrowLabel>
      {action ? <span className="shrink-0 text-[14px]">{action}</span> : null}
    </div>
  )
}
