import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { EyebrowLabel } from './EyebrowLabel'

describe('EyebrowLabel', () => {
  it('renders its children', () => {
    render(<EyebrowLabel>Root</EyebrowLabel>)
    expect(screen.getByText('Root')).toBeInTheDocument()
  })

  it('applies the uppercase tracked treatment', () => {
    const { container } = render(<EyebrowLabel>Root</EyebrowLabel>)
    const root = container.firstElementChild as HTMLElement

    expect(root.className).toContain('uppercase')
    expect(root.className).toMatch(/tracking-/)
  })
})
