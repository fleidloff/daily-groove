import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HowToPlay } from './HowToPlay'

// The four items exactly as the epic writes them. Held here as the test's own
// copy rather than imported from the component, so a silent edit to the words
// fails rather than moving both sides at once (R4, AC5).
const STEPS = [
  'Listen to the groove 🎧',
  'Jam along 🎸',
  'Guess the Root & Mode 🎯',
  'Come back every day for a new challenge ⏭',
]

const EMOJI = ['🎧', '🎸', '🎯', '⏭']

describe('HowToPlay', () => {
  // --- B1: the box lists the four steps (R4, R14, AC5) ---------------------

  it('carries a heading that names what the box explains (R4)', () => {
    render(<HowToPlay onClose={vi.fn()} />)

    expect(
      screen.getByRole('heading', { level: 2, name: 'How to play' }),
    ).toBeInTheDocument()
  })

  it('shows the four items in order with the stated words (R4, AC5)', () => {
    render(<HowToPlay onClose={vi.fn()} />)

    const items = screen
      .getAllByRole('listitem')
      .map((item) => item.textContent?.trim())

    expect(items).toEqual(STEPS)
  })

  it('hides every emoji from the accessibility tree (R14)', () => {
    const { container } = render(<HowToPlay onClose={vi.fn()} />)

    for (const emoji of EMOJI) {
      const marks = Array.from(container.querySelectorAll('span')).filter(
        (span) => span.textContent?.trim() === emoji,
      )

      expect(marks).toHaveLength(1)
      expect(marks[0]).toHaveAttribute('aria-hidden', 'true')
    }
  })

  // --- B2: it is an aside, not a third card (R5a, AC6a) --------------------

  it('sits on the recessed inset surface (R5a, AC6a)', () => {
    const { container } = render(<HowToPlay onClose={vi.fn()} />)
    const root = container.firstElementChild

    expect(root?.className).toContain('bg-surface-inset')
  })

  it('does not use the accent surface the solved panel owns (R5a, AC6a)', () => {
    const { container } = render(<HowToPlay onClose={vi.fn()} />)
    const root = container.firstElementChild

    expect(root?.className).not.toContain('bg-accent')
  })

  // --- B3: closing is a real button (R6, AC10) -----------------------------

  it('carries a close control with an accessible name (R6, AC10)', () => {
    render(<HowToPlay onClose={vi.fn()} />)

    expect(
      screen.getByRole('button', { name: 'Close how to play' }),
    ).toBeInTheDocument()
  })

  it('never submits a form by accident (R6)', () => {
    render(<HowToPlay onClose={vi.fn()} />)

    expect(
      screen.getByRole('button', { name: 'Close how to play' }),
    ).toHaveAttribute('type', 'button')
  })

  it('asks to be closed exactly once when the close control is pressed (R6, AC10)', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<HowToPlay onClose={onClose} />)

    await user.click(screen.getByRole('button', { name: 'Close how to play' }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('is closable by keyboard (R9, AC10)', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()
    render(<HowToPlay onClose={onClose} />)

    const close = screen.getByRole('button', { name: 'Close how to play' })
    close.focus()
    await user.keyboard('{Enter}')

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('numbers the four items 1 to 4 (R4a)', () => {
    const { container } = render(<HowToPlay onClose={vi.fn()} />)

    // An ordered list, so the position is in the document rather than typed
    // into the copy — a screen reader announces it and it cannot drift from
    // the order of `STEPS`.
    const list = container.querySelector('ol')
    expect(list).not.toBeNull()
    expect(container.querySelector('ul')).toBeNull()
    expect((list as HTMLElement).className).toContain('list-decimal')

    // The numbers are the marker's, not the text's: each item still reads back
    // exactly as written.
    for (const item of screen.getAllByRole('listitem')) {
      expect(item.textContent).not.toMatch(/^\s*\d/)
    }
  })

  it('sets the items above body copy, with accent markers (R4b)', () => {
    const { container } = render(<HowToPlay onClose={vi.fn()} />)

    // This is the first thing a new player reads and was the quietest thing on
    // the page: full ink, a size above the 15px body, and accent numbers.
    for (const item of screen.getAllByRole('listitem')) {
      expect(item.className).toContain('text-[16px]')
      expect(item.className).toContain('text-text')
      expect(item.className).not.toContain('text-text-muted')
    }

    const list = container.querySelector('ol') as HTMLElement
    expect(list.className).toContain('marker:text-accent')
  })

  it('holds no state of its own — it never hides itself (R6)', async () => {
    const user = userEvent.setup()
    render(<HowToPlay onClose={vi.fn()} />)

    await user.click(screen.getByRole('button', { name: 'Close how to play' }))

    // Whether the box is on screen is the page's state, not the box's.
    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })
})
