import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { LabelledColumn } from './LabelledColumn'

describe('LabelledColumn', () => {
  it('renders its label and its children', () => {
    render(<LabelledColumn label="Chapter one">Alpha</LabelledColumn>)

    expect(screen.getByText('Chapter one')).toBeInTheDocument()
    expect(screen.getByText('Alpha')).toBeInTheDocument()
  })

  it('associates the label with the group programmatically', () => {
    render(<LabelledColumn label="Chapter one">Alpha</LabelledColumn>)

    expect(screen.getByRole('group', { name: 'Chapter one' })).toBeInTheDocument()
  })

  it('points aria-labelledby at the rendered label element', () => {
    render(<LabelledColumn label="Chapter one">Alpha</LabelledColumn>)

    const group = screen.getByRole('group')
    const labelledBy = group.getAttribute('aria-labelledby')

    expect(labelledBy).toBeTruthy()
    expect(document.getElementById(labelledBy as string)?.textContent).toBe(
      'Chapter one',
    )
  })

  it('gives two columns on one page distinct label ids', () => {
    render(
      <>
        <LabelledColumn label="Chapter one">Alpha</LabelledColumn>
        <LabelledColumn label="Chapter two">Beta</LabelledColumn>
      </>,
    )

    const [first, second] = screen.getAllByRole('group')
    expect(first.getAttribute('aria-labelledby')).not.toBe(
      second.getAttribute('aria-labelledby'),
    )
  })

  it('sets the label as an eyebrow above the content', () => {
    render(<LabelledColumn label="Chapter one">Alpha</LabelledColumn>)
    const label = screen.getByText('Chapter one')

    expect(label.className).toContain('uppercase')
    expect(label.className).toMatch(/tracking-/)
  })

  it('lets the label take its colour from the surface it sits on', () => {
    render(<LabelledColumn label="Chapter one">Alpha</LabelledColumn>)
    const label = screen.getByText('Chapter one')

    expect(label.className).toContain('text-current')
  })

  it('stacks the label over its content', () => {
    const { container } = render(
      <LabelledColumn label="Chapter one">Alpha</LabelledColumn>,
    )
    const root = container.firstElementChild as HTMLElement

    expect(root.className).toContain('flex-col')
  })
})
