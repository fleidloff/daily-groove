import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Text } from './Text'

describe('Text', () => {
  it('renders its children', () => {
    render(<Text>Play along.</Text>)
    expect(screen.getByText('Play along.')).toBeInTheDocument()
  })

  it('resolves each tone to a distinct class string', () => {
    const classes = (['default', 'muted', 'faint'] as const).map(
      (tone) =>
        (render(<Text tone={tone}>x</Text>).container
          .firstElementChild as HTMLElement).className,
    )
    expect(new Set(classes).size).toBe(3)
  })

  it('resolves each size to a distinct class string', () => {
    const classes = (['sm', 'md'] as const).map(
      (size) =>
        (render(<Text size={size}>x</Text>).container
          .firstElementChild as HTMLElement).className,
    )
    expect(new Set(classes).size).toBe(2)
  })

  it('carries no raw colour, only tokens', () => {
    const { container } = render(<Text tone="muted">x</Text>)
    expect((container.firstElementChild as HTMLElement).className).toContain('text-')
  })
})
