import type { ReactNode } from 'react'

export type LetteringSize = 'xs' | 'sm' | 'md' | 'lg'

type LetteringProps = {
  children: ReactNode
  size?: LetteringSize
  sizeAbove?: LetteringSize
}

const SIZE: Record<LetteringSize, string> = {
  xs: 'text-[13px] leading-[1.35]',
  sm: 'text-[15px] leading-[1.3]',
  md: 'text-[20px] leading-[1.2]',
  lg: 'text-[26px] leading-[1.15]',
}

const SIZE_FROM_SM: Record<LetteringSize, string> = {
  xs: 'sm:text-[13px] sm:leading-[1.35]',
  sm: 'sm:text-[15px] sm:leading-[1.3]',
  md: 'sm:text-[20px] sm:leading-[1.2]',
  lg: 'sm:text-[26px] sm:leading-[1.15]',
}

export function Lettering({ children, size = 'md', sizeAbove }: LetteringProps) {
  const scale = sizeAbove ? `${SIZE[size]} ${SIZE_FROM_SM[sizeAbove]}` : SIZE[size]

  return <span className={`font-jazz font-normal ${scale}`}>{children}</span>
}
