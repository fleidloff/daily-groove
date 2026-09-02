import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Lettering, type LetteringSize } from './Lettering'

function renderLettering(ui: React.ReactElement): HTMLElement {
  const { container } = render(ui)
  return container.firstElementChild as HTMLElement
}

describe('Lettering', () => {
  it('renders its children as text', () => {
    render(<Lettering>Cm7</Lettering>)
    expect(screen.getByText('Cm7')).toBeInTheDocument()
  })

  it('sets its text in the jazz face', () => {
    expect(renderLettering(<Lettering>Cm7</Lettering>).className).toMatch(
      /font-jazz/,
    )
  })

  it('keeps the jazz face at every size', () => {
    for (const size of ['xs', 'sm', 'md', 'lg'] as const) {
      expect(
        renderLettering(<Lettering size={size}>Cm7</Lettering>).className,
        size,
      ).toMatch(/font-jazz/)
    }
  })

  it('renders an inline span, so it sits inside a line of drawing', () => {
    expect(renderLettering(<Lettering>Cm7</Lettering>).tagName).toBe('SPAN')
  })

  it('defaults to the middle size', () => {
    const fallback = renderLettering(<Lettering>Cm7</Lettering>).className
    const explicit = renderLettering(<Lettering size="md">Cm7</Lettering>)
      .className
    expect(fallback).toBe(explicit)
  })

  it('resolves each size to a distinct class string', () => {
    const classes = (['xs', 'sm', 'md', 'lg'] as const).map(
      (size) => renderLettering(<Lettering size={size}>Cm7</Lettering>).className,
    )
    expect(new Set(classes).size).toBe(4)
  })

  it('keeps all four sizes in the scale at their documented sizes', () => {
    const DOCUMENTED: Record<LetteringSize, string> = {
      xs: 'text-[13px]',
      sm: 'text-[15px]',
      md: 'text-[20px]',
      lg: 'text-[26px]',
    }
    for (const [size, expected] of Object.entries(DOCUMENTED)) {
      expect(
        renderLettering(
          <Lettering size={size as LetteringSize}>Cm7</Lettering>,
        ).className,
        size,
      ).toContain(expected)
    }
  })

  it('renders the size from sm up as a breakpoint variant', () => {
    const className = renderLettering(
      <Lettering size="sm" sizeAbove="md">
        Cm7
      </Lettering>,
    ).className
    expect(className).toContain('text-[15px]')
    expect(className).toContain('sm:text-[20px]')
  })

  it('renders no breakpoint variant when sizeAbove is absent', () => {
    expect(
      renderLettering(<Lettering size="md">Cm7</Lettering>).className,
    ).toMatch(/^font-jazz font-normal text-\[20px\] leading-\[1\.2\]$/)
  })

  it('sets no colour of its own, so it inherits the surface ink', () => {
    for (const size of ['xs', 'sm', 'md', 'lg'] as const) {
      const className = renderLettering(
        <Lettering size={size}>Cm7</Lettering>,
      ).className
      expect(className, size).not.toMatch(/text-(text|on-accent|accent)/)
      expect(className, size).not.toMatch(/#[0-9a-fA-F]{3,8}\b/)
    }
  })

  it('leaves the inherited ink alone on an inverted surface', () => {
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
