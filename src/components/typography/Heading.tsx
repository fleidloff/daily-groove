import type { ReactNode } from 'react'

type HeadingLevel = 1 | 2 | 3
type HeadingSize = 'sm' | 'md' | 'lg' | 'xl'
type HeadingTone = 'default' | 'inverted'

type HeadingProps = {
  children: ReactNode
  level: HeadingLevel
  size: HeadingSize
  tone?: HeadingTone
}

const TONE: Record<HeadingTone, string> = {
  default: 'text-text',
  inverted: 'text-on-accent',
}

const SIZE: Record<HeadingSize, string> = {
  sm: 'text-[19px] leading-[1.2]',
  md: 'text-[22px] leading-[1.15]',
  lg: 'text-[30px] leading-[1.1]',
  xl: 'text-[34px] leading-[1.05] tracking-[-0.015em] sm:text-[44px]',
}

const FAMILY: Record<HeadingSize, string> = {
  sm: 'font-display',
  md: 'font-display',
  lg: 'font-display',
  xl: 'font-jazz',
}

export function Heading({ children, level, size, tone = 'default' }: HeadingProps) {
  const className = `${FAMILY[size]} font-normal ${TONE[tone]} ${SIZE[size]}`

  if (level === 1) return <h1 className={className}>{children}</h1>
  if (level === 2) return <h2 className={className}>{children}</h2>
  return <h3 className={className}>{children}</h3>
}
