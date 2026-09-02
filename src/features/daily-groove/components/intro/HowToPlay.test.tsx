import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HowToPlay } from './HowToPlay'

const STEPS = [
  'Listen to the groove 🎧',
  'Jam along 🎸',
  'Guess the Root & Mode 🎯',
  'Come back every day for a new challenge ⏭',
]

const EMOJI = ['🎧', '🎸', '🎯', '⏭']

describe('HowToPlay', () => {
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

    const list = container.querySelector('ol')
    expect(list).not.toBeNull()
    expect(container.querySelector('ul')).toBeNull()
    expect((list as HTMLElement).className).toContain('list-decimal')

    for (const item of screen.getAllByRole('listitem')) {
      expect(item.textContent).not.toMatch(/^\s*\d/)
    }
  })

  it('sets the items above body copy, with accent markers (R4b)', () => {
    const { container } = render(<HowToPlay onClose={vi.fn()} />)

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

    expect(screen.getAllByRole('listitem')).toHaveLength(4)
  })

  describe('the drum samples credit', () => {
    const SOURCE = 'Drum samples provided by DrumGizmo.org'

    it('names the credit in the exact words the licence requires', () => {
      render(<HowToPlay onClose={vi.fn()} />)
      expect(screen.getByRole('link', { name: SOURCE })).toHaveAttribute(
        'href',
        'https://drumgizmo.org',
      )
    })

    it('names the licence and links to it', () => {
      render(<HowToPlay onClose={vi.fn()} />)
      expect(screen.getByRole('link', { name: 'CC BY 4.0' })).toHaveAttribute(
        'href',
        'https://creativecommons.org/licenses/by/4.0/',
      )
    })

    it('leaves the site safely, and never navigates the app', () => {
      render(<HowToPlay onClose={vi.fn()} />)
      for (const name of [SOURCE, 'CC BY 4.0']) {
        const link = screen.getByRole('link', { name })
        expect(link.getAttribute('href')).toMatch(/^https:\/\//)
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
      }
    })

    it('is not a fifth step', () => {
      render(<HowToPlay onClose={vi.fn()} />)
      expect(screen.getAllByRole('listitem')).toHaveLength(4)
      expect(screen.getByRole('link', { name: SOURCE }).closest('ol')).toBeNull()
    })

    it('stays the quietest thing in the box', () => {
      render(<HowToPlay onClose={vi.fn()} />)
      const paragraph = screen.getByRole('link', { name: SOURCE }).closest('p')
      expect(paragraph?.className).toContain('text-text-faint')
      expect(paragraph?.className).toContain('text-[13px]')
    })
  })
})
