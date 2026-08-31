import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModeToggle } from './ModeToggle'

describe('ModeToggle', () => {
  // --- C1: the toggle renders and reports (R1, R11, AC1) --------------------

  it('is a switch whose name says what it switches (R1, AC1)', () => {
    render(<ModeToggle simple={false} onChange={vi.fn()} />)

    expect(
      screen.getByRole('switch', { name: /simple mode/i }),
    ).toBeInTheDocument()
  })

  it('reads unchecked when simple mode is off (R1, AC1)', () => {
    render(<ModeToggle simple={false} onChange={vi.fn()} />)

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('reads checked when simple mode is on (R1, AC1)', () => {
    render(<ModeToggle simple onChange={vi.fn()} />)

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('reports the state it is asking for, not the one it is in (R1, AC1)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ModeToggle simple={false} onChange={onChange} />)

    await user.click(screen.getByRole('switch'))

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('asks to go back to the full puzzle when it is already on (R1, AC1)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ModeToggle simple onChange={onChange} />)

    await user.click(screen.getByRole('switch'))

    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('holds no state of its own — the prop is the only truth (R1)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ModeToggle simple={false} onChange={onChange} />)

    await user.click(screen.getByRole('switch'))
    await user.click(screen.getByRole('switch'))

    // A control that had latched locally would ask for `false` the second time.
    expect(onChange).toHaveBeenNthCalledWith(1, true)
    expect(onChange).toHaveBeenNthCalledWith(2, true)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  // --- R11, AC11: keyboard-reachable and keyboard-operable ------------------

  it('is reachable by keyboard (R11, AC11)', async () => {
    const user = userEvent.setup()
    render(<ModeToggle simple={false} onChange={vi.fn()} />)

    await user.tab()

    expect(screen.getByRole('switch')).toHaveFocus()
  })

  it('is operable by the space key (R11, AC11)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ModeToggle simple={false} onChange={onChange} />)

    await user.tab()
    await user.keyboard(' ')

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('is operable by the enter key (R11, AC11)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ModeToggle simple={false} onChange={onChange} />)

    await user.tab()
    await user.keyboard('{Enter}')

    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('never submits a form by accident (R1)', () => {
    render(<ModeToggle simple={false} onChange={vi.fn()} />)

    expect(screen.getByRole('switch')).toHaveAttribute('type', 'button')
  })

  it('names no mode, so neither reading of the row leaks into it (R4)', () => {
    const { container } = render(<ModeToggle simple onChange={vi.fn()} />)

    expect(container).not.toHaveTextContent(
      /ionian|dorian|phrygian|lydian|mixolydian|aeolian|locrian/i,
    )
  })

  // --- F11 E4: the switch settles once the day is over ----------------------

  // Step A1. The prop is optional and defaults to off, so every call site that
  // never heard of it keeps the switch it has today.
  it('is live when it is told nothing about the day being over (F11 E4 R3)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ModeToggle simple={false} onChange={onChange} />)

    expect(screen.getByRole('switch')).toBeEnabled()
    await user.click(screen.getByRole('switch'))

    expect(onChange).toHaveBeenCalledWith(true)
  })

  // Step A2. The mechanism is the native attribute, so the browser is the one
  // declining — not a guard inside the handler (R1a).
  it('carries the native disabled attribute when the day is over (F11 E4 R1a, AC5)', () => {
    render(<ModeToggle simple onChange={vi.fn()} disabled />)

    expect(screen.getByRole('switch')).toBeDisabled()
  })

  it('emits nothing when a settled switch is clicked (F11 E4 R1, AC1)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ModeToggle simple={false} onChange={onChange} disabled />)

    await user.click(screen.getByRole('switch'))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('emits nothing when space or enter reaches a settled switch (F11 E4 R1, AC1)', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ModeToggle simple={false} onChange={onChange} disabled />)

    // Nothing may focus it either — `disabled` takes it out of the tab order.
    await user.tab()
    expect(screen.getByRole('switch')).not.toHaveFocus()

    screen.getByRole('switch').focus()
    await user.keyboard(' ')
    await user.keyboard('{Enter}')

    expect(onChange).not.toHaveBeenCalled()
  })

  // Step A3. Settling is a change of state, not of what the control is: the
  // finished card still has to say which mode the day was played in.
  it('still reads as a switch that is on when it has settled (F11 E4 R4, R5, AC4, AC5)', () => {
    render(<ModeToggle simple onChange={vi.fn()} disabled />)

    const toggle = screen.getByRole('switch', { name: /simple mode/i })
    expect(toggle).toHaveAttribute('aria-checked', 'true')
    expect(toggle).toHaveTextContent(/simple mode/i)
  })

  it('still reads as a switch that is off when it has settled (F11 E4 R4, R5, AC5)', () => {
    render(<ModeToggle simple={false} onChange={vi.fn()} disabled />)

    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false')
  })

  it('keeps drawing the track when it has settled (F11 E4 R4, AC4)', () => {
    const { container } = render(
      <ModeToggle simple onChange={vi.fn()} disabled />,
    )

    // The track is the decoration that shows the position at a glance.
    const track = container.querySelector('[aria-hidden="true"]')
    expect(track).not.toBeNull()
    expect(track?.className).toMatch(/bg-accent/)
  })

  // Step A4. A control that cannot be used must not go on offering itself.
  it('drops the affordances of a live control when it has settled (F11 E4 R6)', () => {
    render(<ModeToggle simple onChange={vi.fn()} disabled />)

    const className = screen.getByRole('switch').className
    expect(className).not.toMatch(/\bcursor-pointer\b/)
    expect(className).not.toMatch(/hover:border-border-strong/)
    expect(className).toMatch(/\bopacity-60\b/)
  })

  it('keeps those affordances while the day is still playable (F11 E4 R3, R6)', () => {
    render(<ModeToggle simple onChange={vi.fn()} />)

    const className = screen.getByRole('switch').className
    expect(className).toMatch(/\bcursor-pointer\b/)
    expect(className).toMatch(/hover:border-border-strong/)
    expect(className).not.toMatch(/\bopacity-60\b/)
  })
})
