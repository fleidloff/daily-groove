import { useId } from 'react'
import type { ReactNode } from 'react'

type LabelledColumnProps = {
  label: string
  children: ReactNode
}

export function LabelledColumn({ label, children }: LabelledColumnProps) {
  const labelId = useId()

  return (
    <div
      role="group"
      aria-labelledby={labelId}
      className="flex flex-col gap-3"
    >
      <span
        id={labelId}
        className="block text-[11px] uppercase tracking-[0.14em] text-current opacity-70"
      >
        {label}
      </span>
      <div>{children}</div>
    </div>
  )
}
