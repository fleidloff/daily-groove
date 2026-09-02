import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Switch } from './Switch'

// An ordinary label, chosen so the primitive's own test names nothing this app
// happens to be about. The words are the caller's; the control never holds any.
const LABEL = 'Notifications'

describe('Switch', () => {
  // --- Step B1: a labelled switch that reports its state (R13, R14, AC12) ---

  it('is a switch whose accessible name is the label it was given', () => {
    render(<Switch label={LABEL} checked={false} onChange={vi.fn()} />)

    expect(
      screen.getByRole('switch', { name: /notifications/i }),
    ).toBeInTheDocument()
  })

  it('reads unchecked when it is off', () => {
    render(<Switch label={LABEL} checked={false} onChange={vi.fn()} />)

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('reads checked when it is on', () => {
    render(<Switch label={LABEL} checked onChange={vi.fn()} />)

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('never submits a form by accident', () => {
    render(<Switch label={LABEL} checked={false} onChange={vi.fn()} />)

    expect(screen.getByRole('switch')).toHaveAttribute('type', 'button')
  })

  // --- Step B2: it asks for a state and holds none of its own (R13) --------

  it('asks to be turned on when it is off', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Switch label={LABEL} checked={false} onChange={onChange} />)

    await user.click(screen.getByRole('switch'))

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('asks to be turned off when it is on', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Switch label={LABEL} checked onChange={onChange} />)

    await user.click(screen.getByRole('switch'))

    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('holds no state of its own — the prop is the only truth', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Switch label={LABEL} checked={false} onChange={onChange} />)

    await user.click(screen.getByRole('switch'))
    await user.click(screen.getByRole('switch'))

    // A control that had latched locally would ask for `false` the second time.
    expect(onChange).toHaveBeenNthCalledWith(1, true)
    expect(onChange).toHaveBeenNthCalledWith(2, true)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  // --- Step B3: keyboard reachable, and operable by space and enter --------

  it('is reachable by keyboard', async () => {
    const user = userEvent.setup()
    render(<Switch label={LABEL} checked={false} onChange={vi.fn()} />)

    await user.tab()

    expect(screen.getByRole('switch')).toHaveFocus()
  })

  it('is operable by the space key', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Switch label={LABEL} checked={false} onChange={onChange} />)

    await user.tab()
    await user.keyboard(' ')

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('is operable by the enter key', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Switch label={LABEL} checked={false} onChange={onChange} />)

    await user.tab()
    await user.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledWith(true)
  })

  // --- Step B4: the track is decoration, and moves with `checked` (R14) ----

  it('draws a track that is hidden from assistive technology', () => {
    const { container } = render(
      <Switch label={LABEL} checked={false} onChange={vi.fn()} />,
    )

    expect(container.querySelector('[aria-hidden="true"]')).not.toBeNull()
  })

  it('fills the track when it is on', () => {
    const { container } = render(
      <Switch label={LABEL} checked onChange={vi.fn()} />,
    )

    const track = container.querySelector('[aria-hidden="true"]')
    expect(track?.className).toMatch(/bg-accent/)
  })

  it('leaves the track unfilled when it is off', () => {
    const { container } = render(
      <Switch label={LABEL} checked={false} onChange={vi.fn()} />,
    )

    const track = container.querySelector('[aria-hidden="true"]')
    expect(track?.className).toMatch(/bg-border-strong/)
  })

  it('announces the label alone, so the state is never read twice', () => {
    render(<Switch label={LABEL} checked onChange={vi.fn()} />)

    const control = screen.getByRole('switch', { name: /notifications/i })
    expect(control.textContent).toContain(LABEL)
    // Whatever the track draws, it contributes no words of its own.
    expect(control.textContent).toBe(LABEL)
  })

  // --- Step B5: settled declines the press, live keeps the affordances -----

  it('carries the native disabled attribute when it is settled', () => {
    render(<Switch label={LABEL} checked onChange={vi.fn()} disabled />)

    expect(screen.getByRole('switch')).toBeDisabled()
  })

  it('emits nothing when a settled switch is clicked', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <Switch label={LABEL} checked={false} onChange={onChange} disabled />,
    )

    await user.click(screen.getByRole('switch'))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('takes no focus when it is settled', async () => {
    const user = userEvent.setup()
    render(<Switch label={LABEL} checked onChange={vi.fn()} disabled />)

    await user.tab()

    expect(screen.getByRole('switch')).not.toHaveFocus()
  })

  it('drops the affordances of a live control when it is settled', () => {
    render(<Switch label={LABEL} checked onChange={vi.fn()} disabled />)

    const classes = screen.getByRole('switch').className
    expect(classes).not.toMatch(/\bcursor-pointer\b/)
    expect(classes).not.toMatch(/hover:border-border-strong/)
    expect(classes).toMatch(/\bopacity-60\b/)
  })

  it('keeps those affordances when it is told nothing about being settled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Switch label={LABEL} checked onChange={onChange} />)

    const control = screen.getByRole('switch')
    expect(control).toBeEnabled()
    expect(control.className).toMatch(/\bcursor-pointer\b/)
    expect(control.className).toMatch(/hover:border-border-strong/)
    expect(control.className).not.toMatch(/\bopacity-60\b/)

    await user.click(control)
    expect(onChange).toHaveBeenCalledWith(false)
  })
})
