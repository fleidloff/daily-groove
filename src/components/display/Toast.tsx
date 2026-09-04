import type { ReactNode } from 'react'

type ToastAlign = 'start' | 'end'

type ToastProps = {
  children: ReactNode
  message?: ReactNode
  align?: ToastAlign
}

const ANCHOR = 'relative inline-flex'

// Bare aria-live rather than role="status": the solved panel already owns the
// page's only role="status", and a second one breaks getByRole('status').
const REGION = 'pointer-events-none absolute top-full z-50 mt-2 whitespace-nowrap'

const SIDE: Record<ToastAlign, string> = { start: 'left-0', end: 'right-0' }

const BUBBLE =
  'rounded-full border border-border-strong bg-surface-inset px-4 py-2 text-[13px] leading-[1.45] text-text shadow-lg'

export function Toast({ children, message, align = 'start' }: ToastProps) {
  return (
    <span className={ANCHOR}>
      {children}
      <span aria-live="polite" className={`${REGION} ${SIDE[align]}`}>
        {message ? <span className={BUBBLE}>{message}</span> : null}
      </span>
    </span>
  )
}
