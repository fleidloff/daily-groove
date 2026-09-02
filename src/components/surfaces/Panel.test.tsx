import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Panel, PanelColumns } from './Panel'

describe('Panel', () => {
  it('renders its children', () => {
    render(<Panel>Alpha</Panel>)
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  it('spans the full width of its container', () => {
    const { container } = render(<Panel>Alpha</Panel>)
    const root = container.firstElementChild as HTMLElement

    expect(root.className).toContain('w-full')
  })

  it('draws the inverted gradient from the accent tokens, not a raw colour', () => {
    const { container } = render(<Panel>Alpha</Panel>)
    const root = container.firstElementChild as HTMLElement

    expect(root.className).toMatch(/bg-linear/)
    expect(root.className).toContain('from-accent')
    expect(root.className).toContain('to-accent-hover')
  })

  it('inverts its text so content reads against the gradient', () => {
    const { container } = render(<Panel>Alpha</Panel>)
    const root = container.firstElementChild as HTMLElement

    expect(root.className).toContain('text-on-accent')
  })

  it('rounds the surface with the panel radius token', () => {
    const { container } = render(<Panel>Alpha</Panel>)
    const root = container.firstElementChild as HTMLElement

    expect(root.className).toMatch(/rounded-(panel|card)/)
  })
})

describe('PanelColumns', () => {
  it('renders its children', () => {
    render(
      <PanelColumns>
        <span>Alpha</span>
        <span>Beta</span>
      </PanelColumns>,
    )
    expect(screen.getByText('Alpha')).toBeInTheDocument()
    expect(screen.getByText('Beta')).toBeInTheDocument()
  })

  it('is a single column at the base breakpoint', () => {
    const { container } = render(<PanelColumns>Alpha</PanelColumns>)
    const root = container.firstElementChild as HTMLElement

    expect(root.className).toContain('grid')
    expect(root.className).toContain('grid-cols-1')
  })

  it('becomes multi-column only above the base breakpoint', () => {
    const { container } = render(<PanelColumns>Alpha</PanelColumns>)
    const root = container.firstElementChild as HTMLElement

    const multi = root.className
      .split(' ')
      .filter((token) => /grid-cols-([2-9]|1[0-2])$/.test(token))

    expect(multi.length).toBeGreaterThan(0)
    expect(multi.every((token) => token.includes(':'))).toBe(true)
  })
})
