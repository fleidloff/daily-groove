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
})
