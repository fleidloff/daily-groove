import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Chip } from './Chip'

describe('Chip', () => {
  it('renders its label as a button', () => {
    render(<Chip label="Alpha" selected={false} disabled={false} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument()
  })

  it('is a type="button" so it never submits a form', () => {
    render(<Chip label="Alpha" selected={false} disabled={false} onSelect={() => {}} />)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('calls onSelect once when clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Chip label="Alpha" selected={false} disabled={false} onSelect={onSelect} />)

    await user.click(screen.getByRole('button', { name: 'Alpha' }))

    expect(onSelect).toHaveBeenCalledTimes(1)
  })

  it('reports its selection through aria-pressed', () => {
    const { rerender } = render(
      <Chip label="Alpha" selected={false} disabled={false} onSelect={() => {}} />,
    )
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute(
      'aria-pressed',
      'false',
    )

    rerender(<Chip label="Alpha" selected disabled={false} onSelect={() => {}} />)
    expect(screen.getByRole('button', { name: 'Alpha' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('does not call onSelect while disabled', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<Chip label="Alpha" selected={false} disabled onSelect={onSelect} />)

    const chip = screen.getByRole('button', { name: 'Alpha' })
    expect(chip).toBeDisabled()
    await user.click(chip)

    expect(onSelect).not.toHaveBeenCalled()
  })

  it('draws idle and selected differently', () => {
    const idle = render(
      <Chip label="A" selected={false} disabled={false} onSelect={() => {}} />,
    ).container.firstElementChild as HTMLElement
    const selected = render(
      <Chip label="A" selected disabled={false} onSelect={() => {}} />,
    ).container.firstElementChild as HTMLElement

    expect(idle.className).not.toBe(selected.className)
    expect(idle.className).toContain('border-border-strong')
    expect(selected.className).toContain('bg-accent')
  })

  it('takes a fixed width when asked, and hugs its label otherwise', () => {
    const auto = render(
      <Chip label="Longer label" selected={false} disabled={false} onSelect={() => {}} />,
    ).container.firstElementChild as HTMLElement
    const fixed = render(
      <Chip label="C" selected={false} disabled={false} onSelect={() => {}} width="fixed" />,
    ).container.firstElementChild as HTMLElement

    expect(auto.className).not.toMatch(/\bw-\[/)
    expect(fixed.className).toMatch(/\bw-\[/)
  })

  it('defaults to the default tone', () => {
    const implicit = render(
      <Chip label="A" selected={false} disabled={false} onSelect={() => {}} />,
    ).container.firstElementChild as HTMLElement
    const explicit = render(
      <Chip label="A" selected={false} disabled={false} onSelect={() => {}} tone="default" />,
    ).container.firstElementChild as HTMLElement

    expect(implicit.className).toBe(explicit.className)
  })

  it('draws the inverted tone differently from the default one', () => {
    const base = render(
      <Chip label="A" selected={false} disabled={false} onSelect={() => {}} />,
    ).container.firstElementChild as HTMLElement
    const inverted = render(
      <Chip label="A" selected={false} disabled={false} onSelect={() => {}} tone="inverted" />,
    ).container.firstElementChild as HTMLElement

    expect(inverted.className).not.toBe(base.className)
  })

  it('still renders its label in the inverted tone', () => {
    render(
      <Chip
        label="Alpha"
        selected={false}
        disabled={false}
        onSelect={() => {}}
        tone="inverted"
      />,
    )

    expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument()
  })

  it('gives the inverted tone a translucent light treatment from the tokens', () => {
    const inverted = render(
      <Chip label="A" selected={false} disabled={false} onSelect={() => {}} tone="inverted" />,
    ).container.firstElementChild as HTMLElement

    expect(inverted.className).toMatch(/bg-on-accent\/\d+/)
    expect(inverted.className).toContain('text-on-accent')
  })

  it('separates selected from idle within the inverted tone too', () => {
    const idle = render(
      <Chip label="A" selected={false} disabled={false} onSelect={() => {}} tone="inverted" />,
    ).container.firstElementChild as HTMLElement
    const selected = render(
      <Chip label="A" selected disabled={false} onSelect={() => {}} tone="inverted" />,
    ).container.firstElementChild as HTMLElement

    expect(idle.className).not.toBe(selected.className)
  })
})
