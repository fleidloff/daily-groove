import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SharedGrooveNotice } from './SharedGrooveNotice'

/**
 * The notice that frames a shared groove (F12 E3 Step A3 — R1, R2, R3, R5, R6,
 * R7, AC1, AC2, AC4, AC5).
 *
 * It is the page saying what it is, in words, before anything is pressed: this
 * is somebody's groove, not today's puzzle, and playing it costs the player
 * nothing. It also carries the one way back.
 */
describe('SharedGrooveNotice', () => {
  it('names this a shared groove rather than today’s puzzle (R1, AC1)', () => {
    const { container } = render(<SharedGrooveNotice />)

    const text = container.textContent ?? ''
    expect(text).toMatch(/shared groove/i)
    expect(text).toMatch(/not today's puzzle|not today’s puzzle/i)
  })

  it('says playing it leaves the streak and the day alone (R2, AC2)', () => {
    const { container } = render(<SharedGrooveNotice />)

    const text = container.textContent ?? ''
    expect(text).toMatch(/streak/i)
    // Both halves of R2: the run, and the day at `/` that is still waiting.
    expect(text).toMatch(/day/i)
    expect(text).toMatch(/won't|won’t|does not|doesn't|doesn’t|no effect/i)
  })

  it('renders exactly one link, and it points at today (R5, R7, AC5)', () => {
    render(<SharedGrooveNotice />)

    const links = screen.getAllByRole('link')
    expect(links).toHaveLength(1)
    expect(links[0]).toHaveAttribute('href', '/')
  })

  it('invites the player to today’s puzzle in the link itself (R5, R6)', () => {
    render(<SharedGrooveNotice />)

    // The link's own name has to say where it goes: a bare "here" would make
    // the way back unreadable out of context (and to a screen reader reading
    // the page's links on their own).
    const link = screen.getByRole('link')
    expect(link).toHaveAccessibleName(/today/i)
    expect(link.textContent ?? '').toMatch(/today/i)
  })

  it('takes the way home as a prop, defaulting to /', () => {
    render(<SharedGrooveNotice homeHref="/?from=test" />)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/?from=test')
  })

  it('holds no puzzle and no control of its own (R4)', () => {
    render(<SharedGrooveNotice />)

    // Copy and one link. Not a banner, not a modal, and nothing to dismiss.
    expect(screen.queryAllByRole('button')).toEqual([])
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
