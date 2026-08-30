import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MiniCard, MiniCardGrid } from './MiniCard'

describe('MiniCard', () => {
  it('renders its children', () => {
    render(<MiniCard>Alpha</MiniCard>)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  it('draws a bordered surface from the tokens', () => {
    const { container } = render(<MiniCard>Alpha</MiniCard>)
    const root = container.firstElementChild as HTMLElement

    expect(root.className).toContain('border-border')
    expect(root.className).toContain('bg-surface')
    expect(root.className).toContain('rounded-panel')
  })

  it('flows its content in a column', () => {
    const { container } = render(<MiniCard>Alpha</MiniCard>)
    const root = container.firstElementChild as HTMLElement

    expect(root.className).toContain('flex-col')
  })
})

describe('MiniCardGrid', () => {
  it('renders its children', () => {
    render(
      <MiniCardGrid>
        <MiniCard>Alpha</MiniCard>
        <MiniCard>Beta</MiniCard>
      </MiniCardGrid>,
    )

    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('is at most two columns at the base breakpoint', () => {
    const { container } = render(<MiniCardGrid>Alpha</MiniCardGrid>)
    const root = container.firstElementChild as HTMLElement

    const base = root.className
      .split(' ')
      .filter((token) => /^grid-cols-\d+$/.test(token))

    expect(root.className).toContain('grid')
    expect(base).toHaveLength(1)
    expect(Number(base[0].replace('grid-cols-', ''))).toBeLessThanOrEqual(2)
  })

  it('reaches seven columns only above the base breakpoint', () => {
    const { container } = render(<MiniCardGrid>Alpha</MiniCardGrid>)
    const root = container.firstElementChild as HTMLElement

    const wide = root.className
      .split(' ')
      .filter((token) => token.endsWith('grid-cols-7'))

    expect(wide).toHaveLength(1)
    expect(wide[0]).toContain(':')
  })
})
