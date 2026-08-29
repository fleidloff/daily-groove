import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Card } from './Card'

describe('Card', () => {
  it('renders its children in the default raised tone', () => {
    render(<Card>a</Card>)
    expect(screen.getByText('a')).toBeInTheDocument()
  })

  it('renders its children in the inset tone', () => {
    render(<Card tone="inset">b</Card>)
    expect(screen.getByText('b')).toBeInTheDocument()
  })

  it('gives the two tones different class strings', () => {
    const raised = render(<Card>a</Card>).container.firstElementChild as HTMLElement
    const inset = render(<Card tone="inset">b</Card>).container
      .firstElementChild as HTMLElement

    expect(raised.className).not.toBe(inset.className)
  })

  it('draws the raised tone on the card surface with the card radius', () => {
    const { container } = render(<Card>a</Card>)
    const root = container.firstElementChild as HTMLElement

    expect(root.className).toContain('bg-surface')
    expect(root.className).toContain('rounded-card')
  })

  it('draws the inset tone on the inset surface', () => {
    const { container } = render(<Card tone="inset">b</Card>)
    const root = container.firstElementChild as HTMLElement

    expect(root.className).toContain('bg-surface-inset')
  })
})
