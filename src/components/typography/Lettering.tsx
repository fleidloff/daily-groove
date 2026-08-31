import type { ReactNode } from 'react'

type LetteringSize = 'sm' | 'md' | 'lg'

type LetteringProps = {
  children: ReactNode
  size?: LetteringSize
}

const SIZE: Record<LetteringSize, string> = {
  sm: 'text-[15px] leading-[1.3]',
  md: 'text-[20px] leading-[1.2]',
  lg: 'text-[26px] leading-[1.15]',
}

/**
 * Text in the hand-lettered face. Nothing more: it is the one way to reach
 * `font-jazz` without spelling the utility out at a call site.
 *
 * It names no tone. The face is used on inked paper and on accent-filled
 * surfaces alike, so the colour is whatever the surface has already set —
 * inherited through `currentColor` rather than chosen here.
 */
export function Lettering({ children, size = 'md' }: LetteringProps) {
  return <span className={`font-jazz font-normal ${SIZE[size]}`}>{children}</span>
}
