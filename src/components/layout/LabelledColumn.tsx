import { useId } from 'react'
import type { ReactNode } from 'react'

type LabelledColumnProps = {
  label: string
  children: ReactNode
}

/**
 * An eyebrow label over its content, exposed as a labelled group so assistive
 * technology reads the two as one unit rather than as loose text.
 *
 * The label takes its colour from the surface it sits on rather than from a
 * fixed token, so the same column reads correctly on paper and on an inverted
 * panel without the caller choosing a treatment.
 */
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
