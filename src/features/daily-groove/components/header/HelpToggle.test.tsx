import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HelpToggle } from './HelpToggle'

describe('HelpToggle', () => {
  // --- B3: reopening is a real button (R8, R9, AC10) -----------------------

  it('is a button whose accessible name says what it opens (R9, AC10)', () => {
    render(<HelpToggle onShow={vi.fn()} />)

    expect(
      screen.getByRole('button', { name: 'How to play' }),
    ).toBeInTheDocument()
  })

  it('shows a question mark (R8)', () => {
    render(<HelpToggle onShow={vi.fn()} />)

    expect(
      screen.getByRole('button', { name: 'How to play' }).textContent?.trim(),
    ).toBe('?')
  })

  it('never submits a form by accident (R9)', () => {
    render(<HelpToggle onShow={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'How to play' })).toHaveAttribute(
      'type',
      'button',
    )
  })

  it('asks for the box exactly once when clicked (R8, AC10)', async () => {
    const user = userEvent.setup()
    const onShow = vi.fn()
    render(<HelpToggle onShow={onShow} />)

    await user.click(screen.getByRole('button', { name: 'How to play' }))

    expect(onShow).toHaveBeenCalledTimes(1)
  })

  it('is reachable by keyboard (R9, AC10)', async () => {
    const user = userEvent.setup()
    render(<HelpToggle onShow={vi.fn()} />)

    await user.tab()

    expect(screen.getByRole('button', { name: 'How to play' })).toHaveFocus()
  })

  // The half a `<span onClick>` would silently fail.
  it('is operable by the enter key (R9, AC10)', async () => {
    const user = userEvent.setup()
    const onShow = vi.fn()
    render(<HelpToggle onShow={onShow} />)

    await user.tab()
    await user.keyboard('{Enter}')

    expect(onShow).toHaveBeenCalledTimes(1)
  })

  it('is operable by the space key (R9, AC10)', async () => {
    const user = userEvent.setup()
    const onShow = vi.fn()
    render(<HelpToggle onShow={onShow} />)

    await user.tab()
    await user.keyboard(' ')

    expect(onShow).toHaveBeenCalledTimes(1)
  })

  it('only ever asks to show, never to hide (R8)', async () => {
    const user = userEvent.setup()
    const onShow = vi.fn()
    render(<HelpToggle onShow={onShow} />)

    const toggle = screen.getByRole('button', { name: 'How to play' })
    await user.click(toggle)
    await user.click(toggle)

    // No `aria-pressed`, no latch: the box has its own close control, and a
    // question mark that hides things is a surprise.
    expect(onShow).toHaveBeenCalledTimes(2)
    expect(toggle).not.toHaveAttribute('aria-pressed')
  })
})
