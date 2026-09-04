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

  it('sizes itself to its content unless asked to fill', () => {
    const { container } = render(<Stack gap="sm">x</Stack>)
    const root = container.firstElementChild as HTMLElement

    expect(root.className).not.toContain('h-full')
  })

  it('fills its container when asked, so a child can sit at the bottom', () => {
    const { container } = render(
      <Stack gap="sm" fill>
        x
      </Stack>,
    )
    const root = container.firstElementChild as HTMLElement

    expect(root.className).toContain('h-full')
    expect(root.className).toContain('flex-col')
  })

  it('stretches its children unless asked to align them', () => {
    const { container } = render(<Stack gap="sm">x</Stack>)
    const root = container.firstElementChild as HTMLElement

    expect(root.className).not.toContain('items-')
  })

  it('resolves each alignment to a distinct class', () => {
    const classes = (['start', 'center', 'end'] as const).map(
      (align) =>
        (
          render(
            <Stack gap="sm" align={align}>
              x
            </Stack>,
          ).container.firstElementChild as HTMLElement
        ).className,
    )

    expect(new Set(classes).size).toBe(3)
    expect(classes[2]).toContain('items-end')
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
