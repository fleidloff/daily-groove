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

export function Lettering({ children, size = 'md' }: LetteringProps) {
  return <span className={`font-jazz font-normal ${SIZE[size]}`}>{children}</span>
}
