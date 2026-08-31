import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Lettering } from './Lettering'

/** The rendered element itself — the primitive renders exactly one node. */
function renderLettering(ui: React.ReactElement): HTMLElement {
  const { container } = render(ui)
  return container.firstElementChild as HTMLElement
}

describe('Lettering', () => {
  // Step B1 — R4
  it('renders its children as text', () => {
    render(<Lettering>Cm7</Lettering>)
    expect(screen.getByText('Cm7')).toBeInTheDocument()
  })

  // Step B1 — R4
  it('sets its text in the jazz face', () => {
    expect(renderLettering(<Lettering>Cm7</Lettering>).className).toMatch(
      /font-jazz/,
    )
  })

  // Step B1 — R4
  it('keeps the jazz face at every size', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      expect(
        renderLettering(<Lettering size={size}>Cm7</Lettering>).className,
        size,
      ).toMatch(/font-jazz/)
    }
  })

  // Step B1 — R4
  it('renders an inline span, so it sits inside a line of drawing', () => {
    expect(renderLettering(<Lettering>Cm7</Lettering>).tagName).toBe('SPAN')
  })

  // Step B1 — R4
  it('defaults to the middle size', () => {
    const fallback = renderLettering(<Lettering>Cm7</Lettering>).className
    const explicit = renderLettering(<Lettering size="md">Cm7</Lettering>)
      .className
    expect(fallback).toBe(explicit)
  })

  // Step B1 — R4
  it('resolves each size to a distinct class string', () => {
    const classes = (['sm', 'md', 'lg'] as const).map(
      (size) => renderLettering(<Lettering size={size}>Cm7</Lettering>).className,
    )
    expect(new Set(classes).size).toBe(3)
  })

  // Step B2 — R8
  it('sets no colour of its own, so it inherits the surface ink', () => {
    for (const size of ['sm', 'md', 'lg'] as const) {
      const className = renderLettering(
        <Lettering size={size}>Cm7</Lettering>,
      ).className
      // Size classes may still be `text-[…px]`; a *tone* may not appear.
      expect(className, size).not.toMatch(/text-(text|on-accent|accent)/)
      expect(className, size).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
  })

  // Step B2 — R8
  it('leaves the inherited ink alone on an inverted surface', () => {
    // What the payoff panel actually does: it sets the ink, the lettering takes
    // it. Nothing on the span may override the colour it is given.
    const { container } = render(
      <div className="text-on-accent">
        <Lettering size="lg">B♭maj7</Lettering>
      </div>,
    )
    const span = container.querySelector('span') as HTMLElement
    expect(span.className).not.toMatch(/\btext-(text|on-accent|accent)/)
    expect(span.getAttribute('style')).toBeNull()
  })
})
