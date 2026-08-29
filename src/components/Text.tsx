import type { ReactNode } from 'react'

type TextTone = 'default' | 'muted' | 'faint' | 'inverted' | 'inverted-muted'
type TextSize = 'sm' | 'md'

type TextProps = {
  children: ReactNode
  tone?: TextTone
  size?: TextSize
}

const TONE: Record<TextTone, string> = {
  default: 'text-text',
  muted: 'text-text-muted',
  faint: 'text-text-faint',
  // For accent-filled surfaces, whose ink flips with the palette.
  inverted: 'text-on-accent',
  'inverted-muted': 'text-on-accent/75',
}

const SIZE: Record<TextSize, string> = {
  sm: 'text-[13px] leading-[1.45]',
  md: 'text-[15px] leading-[1.55]',
}

/** Body copy. */
export function Text({ children, tone = 'default', size = 'md' }: TextProps) {
  return <p className={`${TONE[tone]} ${SIZE[size]}`}>{children}</p>
}
