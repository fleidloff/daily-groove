import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Container } from './Container'

describe('Container', () => {
  it('renders its children', () => {
    render(<Container>centred</Container>)
    expect(screen.getByText('centred')).toBeInTheDocument()
  })

  it('centres a bounded measure', () => {
    const { container } = render(<Container>centred</Container>)
    const root = container.firstElementChild as HTMLElement

    expect(root.className).toMatch(/max-w-/)
    expect(root.className).toMatch(/mx-auto/)
  })
})
