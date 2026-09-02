import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AttemptDots } from './AttemptDots'
import { renderFeature } from '../../testing/renderFeature'
import type { DotState } from '../../lib/presentation/feedback'

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

  it('explains that three is par and guessing continues, in the accessible name (R1, R2, AC1)', () => {
    render(<AttemptDots states={['spent', 'spent', 'unspent']} />)

    const row = screen.getByRole('img')
    expect(row).toHaveAccessibleName(expect.stringContaining('2 of 3 attempts spent'))
    expect(row).toHaveAccessibleName(expect.stringMatching(/par/i))
    expect(row).toHaveAccessibleName(expect.stringMatching(/not a limit/i))
    expect(row).toHaveAccessibleName(expect.stringMatching(/keep guessing/i))
  })

  it('carries the same words in a native title, so a pointer gets them too (R2, AC1)', () => {
    render(<AttemptDots states={['spent', 'unspent', 'unspent']} />)

    const row = screen.getByRole('img')
    const title = row.getAttribute('title')

    expect(title).not.toBeNull()
    expect(title).toBe(row.getAttribute('aria-label'))
    expect(title).toMatch(/par/i)
    expect(title).toMatch(/keep guessing/i)
  })

  it('keeps the solved branch short rather than explaining a finished day (R1, AC1)', () => {
    render(<AttemptDots states={['solved', 'solved', 'solved']} />)

    const row = screen.getByRole('img')
    expect(row).toHaveAccessibleName('Solved')
    expect(row).toHaveAttribute('title', 'Solved')
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

describe('through the composed page', () => {
  it("opens with three unspent attempt dots and the opening guidance", async () => {
    await renderFeature();

    const dots = Array.from(
      document.querySelectorAll("[data-dot-state]"),
    ).map((el) => el.getAttribute("data-dot-state"));
    expect(dots).toEqual(["unspent", "unspent", "unspent"]);
    expect(screen.getByRole("status")).toHaveTextContent(/feels like rest/i);
    expect(
      screen.queryByRole("complementary", { name: "A nudge" }),
    ).not.toBeInTheDocument();
  })
})
