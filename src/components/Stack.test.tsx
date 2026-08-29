import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Stack } from './Stack'

describe('Stack', () => {
  it('renders every child', () => {
    render(
      <Stack gap="md">
        <span>one</span>
        <span>two</span>
        <span>three</span>
      </Stack>,
    )
    expect(screen.getByText('one')).toBeInTheDocument()
    expect(screen.getByText('two')).toBeInTheDocument()
    expect(screen.getByText('three')).toBeInTheDocument()
  })

  it('stacks vertically', () => {
    const { container } = render(<Stack gap="sm">x</Stack>)
    const root = container.firstElementChild as HTMLElement

    expect(root.className).toContain('flex')
    expect(root.className).toContain('flex-col')
  })

  it('resolves each gap on the token scale to a distinct class', () => {
    const classes = (['xs', 'sm', 'md', 'lg', 'xl'] as const).map(
      (gap) =>
        (render(<Stack gap={gap}>x</Stack>).container.firstElementChild as HTMLElement)
          .className,
    )

    expect(new Set(classes).size).toBe(5)
  })
})
