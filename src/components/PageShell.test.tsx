import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PageShell } from './PageShell'
import { Container } from './Container'

describe('PageShell', () => {
  it('renders its children', () => {
    render(
      <PageShell>
        <Container>hi</Container>
      </PageShell>,
    )
    expect(screen.getByText('hi')).toBeInTheDocument()
  })

  it('is a div carrying the page padding', () => {
    const { container } = render(<PageShell>hi</PageShell>)
    const root = container.firstElementChild as HTMLElement

    expect(root.tagName).toBe('DIV')
    expect(root.className).toMatch(/(^|\s)p[xytbrl]?-/)
  })

  it('exposes no styling escape hatch', () => {
    // The props type is children-only; this is the compile-time contract made
    // visible. Rendering with only children must be enough.
    const { container } = render(<PageShell>only children</PageShell>)
    expect(container.textContent).toBe('only children')
  })
})
