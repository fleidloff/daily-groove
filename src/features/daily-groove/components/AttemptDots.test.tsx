import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AttemptDots } from './AttemptDots'
import type { DotState } from '../lib/feedback'

function dotsIn(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('[data-dot-state]')]
}

function classOf(container: HTMLElement, state: DotState): string {
  const dot = dotsIn(container).find(
    (element) => element.dataset.dotState === state,
  )
  if (!dot) throw new Error(`no dot in state "${state}" was rendered`)
  return dot.className
}

describe('AttemptDots', () => {
  it('renders one dot per state (R2, AC1)', () => {
    const { container } = render(
      <AttemptDots states={['unspent', 'unspent', 'unspent']} />,
    )
    expect(dotsIn(container)).toHaveLength(3)
  })

  it('renders exactly three dots however many attempts were spent (R2, AC3)', () => {
    const { container } = render(
      <AttemptDots states={['spent', 'spent', 'spent']} />,
    )
    expect(dotsIn(container)).toHaveLength(3)
  })

  it('marks each dot with the state it was given (R1, AC2)', () => {
    const { container } = render(
      <AttemptDots states={['spent', 'unspent', 'unspent']} />,
    )
    expect(dotsIn(container).map((dot) => dot.dataset.dotState)).toEqual([
      'spent',
      'unspent',
      'unspent',
    ])
  })

  it('gives the three states distinguishable classes (R1, AC1, AC2)', () => {
    const { container } = render(
      <AttemptDots states={['unspent', 'spent', 'solved']} />,
    )
    const unspent = classOf(container, 'unspent')
    const spent = classOf(container, 'spent')
    const solved = classOf(container, 'solved')

    expect(unspent).not.toBe(spent)
    expect(spent).not.toBe(solved)
    expect(unspent).not.toBe(solved)
  })

  it('labels the row with how many attempts are spent (R1, AC1)', () => {
    render(<AttemptDots states={['unspent', 'unspent', 'unspent']} />)
    expect(
      screen.getByRole('img', { name: /0 of 3 attempts spent/i }),
    ).toBeInTheDocument()
  })

  it('counts the spent attempts in the label (R1, AC2)', () => {
    render(<AttemptDots states={['spent', 'unspent', 'unspent']} />)
    expect(
      screen.getByRole('img', { name: /1 of 3 attempts spent/i }),
    ).toBeInTheDocument()
  })

  it('says the day is solved rather than counting misses (R1)', () => {
    render(<AttemptDots states={['solved', 'solved', 'solved']} />)
    expect(screen.getByRole('img', { name: /solved/i })).toBeInTheDocument()
  })

  it('hides the individual dots from assistive technology (R10)', () => {
    const { container } = render(
      <AttemptDots states={['spent', 'unspent', 'unspent']} />,
    )
    for (const dot of dotsIn(container)) {
      expect(dot).toHaveAttribute('aria-hidden', 'true')
    }
  })
})
