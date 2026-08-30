import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SectionLabel } from './SectionLabel'

describe('SectionLabel', () => {
  it('renders its label', () => {
    render(<SectionLabel>Chapter one</SectionLabel>)
    expect(screen.getByText('Chapter one')).toBeInTheDocument()
  })

  it('renders as an eyebrow', () => {
    render(<SectionLabel>Chapter one</SectionLabel>)
    const label = screen.getByText('Chapter one')

    expect(label.className).toContain('uppercase')
    expect(label.className).toMatch(/tracking-/)
  })

  it('renders no action node when none is given', () => {
    const { container } = render(<SectionLabel>Chapter one</SectionLabel>)

    expect(screen.queryByRole('link')).not.toBeInTheDocument()
    expect(container.textContent).toBe('Chapter one')
  })

  it('renders an action node beside the label', () => {
    render(
      <SectionLabel action={<a href="#alpha">Continue</a>}>Chapter one</SectionLabel>,
    )

    expect(screen.getByRole('link', { name: 'Continue' })).toBeInTheDocument()
  })

  it('puts the action after the label, pushed to the far side of the row', () => {
    const { container } = render(
      <SectionLabel action={<span>Continue</span>}>Chapter one</SectionLabel>,
    )
    const root = container.firstElementChild as HTMLElement

    expect(root.className).toContain('flex')
    expect(root.className).toContain('justify-between')
    expect(root.textContent).toBe('Chapter oneContinue')
  })
})
