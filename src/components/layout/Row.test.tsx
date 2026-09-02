import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Row } from './Row'

describe('Row', () => {
  it('renders every child', () => {
    render(
      <Row gap="md">
        <span>one</span>
        <span>two</span>
        <span>three</span>
      </Row>,
    )
    expect(screen.getByText('one')).toBeInTheDocument()
    expect(screen.getByText('two')).toBeInTheDocument()
    expect(screen.getByText('three')).toBeInTheDocument()
  })

  it('accepts align and justify without error', () => {
    render(
      <Row gap="lg" align="baseline" justify="between">
        <span>left</span>
        <span>right</span>
      </Row>,
    )
    expect(screen.getByText('left')).toBeInTheDocument()
    expect(screen.getByText('right')).toBeInTheDocument()
  })

  it('resolves align and justify to distinct classes', () => {
    const aligns = (['start', 'center', 'end', 'baseline'] as const).map(
      (align) =>
        (render(<Row gap="md" align={align}>x</Row>).container
          .firstElementChild as HTMLElement).className,
    )
    const justifies = (['start', 'between', 'end'] as const).map(
      (justify) =>
        (render(<Row gap="md" justify={justify}>x</Row>).container
          .firstElementChild as HTMLElement).className,
    )

    expect(new Set(aligns).size).toBe(4)
    expect(new Set(justifies).size).toBe(3)
  })

  it('is a single row by default', () => {
    const { container } = render(<Row gap="md">x</Row>)
    const root = container.firstElementChild as HTMLElement

    expect(root.className).toContain('flex-row')
    expect(root.className).not.toContain('flex-col')
  })

  it('collapses to one column below the named breakpoint', () => {
    const { container } = render(
      <Row gap="md" collapseBelow="md">
        x
      </Row>,
    )
    const root = container.firstElementChild as HTMLElement

    expect(root.className).toContain('flex-col')
    expect(root.className).toContain('md:flex-row')
  })
})
