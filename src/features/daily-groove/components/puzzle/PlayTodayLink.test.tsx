import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayTodayLink } from './PlayTodayLink'

/**
 * The invitation that closes a shared groove (F12 E3 Step A6 — R5a, R5b, R5c,
 * R7, AC5, AC14, AC15, AC16).
 *
 * A shared link that ends with an answer and nothing to do next is a dead end.
 * This is the natural next move, and the whole of it: one line and one link, to
 * `/`.
 */
describe('PlayTodayLink', () => {
  it('renders exactly one link, and it points at today (R7, AC5)', () => {
    render(<PlayTodayLink />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/')
  })

  it('invites the player to play today’s groove (R5a, AC14)', () => {
    render(<PlayTodayLink />)

    const link = screen.getByRole('link')
    expect(link).toHaveAccessibleName(/today/i)
    expect(link.textContent ?? '').toMatch(/play today/i)
  })

  it('says why it is there, in a line beside the link (R5a)', () => {
    const { container } = render(<PlayTodayLink />)

    // The shared groove is over; today's is still waiting.
    expect(container.textContent ?? '').toMatch(/today/i)
    expect(container.textContent ?? '').toMatch(/shared groove/i)
  })

  it('takes the way home as a prop, defaulting to /', () => {
    render(<PlayTodayLink homeHref="/?from=test" />)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/?from=test')
  })

  it('offers nothing to press and nothing to dismiss (R5b)', () => {
    render(<PlayTodayLink />)

    // It stays for the rest of the session, so it holds no control of its own —
    // there is nothing here that could clear it.
    expect(screen.queryAllByRole('button')).toEqual([])
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
