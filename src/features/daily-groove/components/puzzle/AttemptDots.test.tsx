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

  it('hides the individual dots from assistive technology (R10)', () => {
    const { container } = render(
      <AttemptDots states={['spent', 'unspent', 'unspent']} />,
    )
    for (const dot of dotsIn(container)) {
      expect(dot).toHaveAttribute('aria-hidden', 'true')
    }
  })
})

/**
 * Relocated from `src/app/page.test.tsx` (Epic 3, Step C2). What an untouched
 * day opens with: three unspent dots, the opening guidance, and no nudge. The
 * dot row is this file's subject and the other two are the state it opens
 * beside, so the test stays whole and keeps its composed render.
 *
 * The guidance and the nudge are also pinned as values next to the function
 * that decides them, in `lib/presentation/feedback.test.ts` — those assertions
 * predate this move; these are the rendered half.
 */
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
