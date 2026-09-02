import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PlayTodayLink } from './PlayTodayLink'

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

    expect(container.textContent ?? '').toMatch(/today/i)
    expect(container.textContent ?? '').toMatch(/shared groove/i)
  })

  it('takes the way home as a prop, defaulting to /', () => {
    render(<PlayTodayLink homeHref="/?from=test" />)

    expect(screen.getByRole('link')).toHaveAttribute('href', '/?from=test')
  })

  it('offers nothing to press and nothing to dismiss (R5b)', () => {
    render(<PlayTodayLink />)

    expect(screen.queryAllByRole('button')).toEqual([])
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
