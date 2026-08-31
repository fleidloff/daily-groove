import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { LeadSheet } from './LeadSheet'

const CHANGES = ['C7', 'Em7♭5', 'B♭maj7', 'Fmaj7']

/** The bar elements, in document order. */
function bars(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-bar]'))
}

describe('LeadSheet', () => {
  // --- Step C1 — R1, R12, AC1 ----------------------------------------------

  it('draws one chord symbol per bar, in order (R1, AC1)', () => {
    const { container } = render(<LeadSheet chords={CHANGES} />)

    expect(bars(container).map((bar) => bar.textContent)).toEqual(CHANGES)
  })

  it('sets every symbol in the hand-lettered jazz face (R4, AC5)', () => {
    const { container } = render(<LeadSheet chords={CHANGES} />)

    for (const chord of CHANGES) {
      expect(within(container).getByText(chord).className).toMatch(/font-jazz/)
    }
  })

  it('is a drawing, not a control: nothing to press and nothing to focus (R12)', () => {
    const { container } = render(<LeadSheet chords={CHANGES} />)

    expect(within(container).queryAllByRole('button')).toHaveLength(0)
    expect(container.querySelectorAll('[tabindex]')).toHaveLength(0)
  })

  // --- Step C2 — R5, R5a, AC5, AC5a ----------------------------------------

  it('rules every bar with a bar line on its left (R5, AC5)', () => {
    const { container } = render(<LeadSheet chords={CHANGES} />)

    for (const bar of bars(container)) {
      expect(bar.className).toMatch(/\bborder-l\b/)
    }
  })

  it('closes the figure with a doubled bar line as tall as the sheet (R5, AC5)', () => {
    const { container } = render(<LeadSheet chords={CHANGES} />)
    const sheet = screen.getByRole('img')
    const drawn = bars(container)

    // The thick half of the double bar rides on the sheet's right edge, not on
    // the last bar, so it is one row deep across four bars and two rows deep
    // when they break 2 × 2. `inset-y-0` on the thin half is the same rule.
    expect(sheet.className).toMatch(/border-r-\[3px\]/)
    const thin = sheet.querySelector(':scope > [data-double-bar]')
    expect(thin).not.toBeNull()
    expect((thin as HTMLElement).className).toMatch(/\bborder-r\b/)
    expect((thin as HTMLElement).className).toMatch(/\binset-y-0\b/)

    // No bar closes itself — a rule that stopped at the last cell would end
    // half way up the right-hand side of a broken sheet.
    for (const bar of drawn) {
      expect(bar.className).not.toMatch(/border-r/)
      expect(bar.querySelector('[data-double-bar]')).toBeNull()
    }
  })

  it('carries no stave and no rhythm slashes (R5a, AC5a)', () => {
    const { container } = render(<LeadSheet chords={CHANGES} />)

    expect(container.querySelector('svg')).toBeNull()
    expect(container.innerHTML).not.toMatch(/stave|staff|slash/i)
    // A stave is horizontal rules; a lead sheet's bar lines are vertical only.
    for (const element of container.querySelectorAll<HTMLElement>('*')) {
      expect(element.className).not.toMatch(/\bborder-[tb]\b/)
    }
  })

  it('shows the chords and nothing else — no title, key or tempo (R5a, AC5a)', () => {
    const { container } = render(<LeadSheet chords={CHANGES} />)

    expect(container.textContent).toBe(CHANGES.join(''))
  })

  // --- Step C3 — R9, AC6 ---------------------------------------------------

  it('reads as the four chords in order to a screen reader (R9, AC6)', () => {
    render(<LeadSheet chords={CHANGES} />)

    expect(
      screen.getByRole('img', { name: 'C7 · Em7♭5 · B♭maj7 · Fmaj7' }),
    ).toBeInTheDocument()
  })

  it('does not announce the bars themselves, shape by shape (R9, AC6)', () => {
    const { container } = render(<LeadSheet chords={CHANGES} />)

    for (const bar of bars(container)) {
      expect(bar).not.toHaveAttribute('role')
      expect(bar).not.toHaveAttribute('aria-label')
    }
    expect(container.querySelector('[data-double-bar]')).toHaveAttribute(
      'aria-hidden',
      'true',
    )
  })

  // --- Step C4 — R10 -------------------------------------------------------

  it('breaks two-by-two, never three-and-one, on a phone (R10)', () => {
    const { container } = render(<LeadSheet chords={CHANGES} />)
    const sheet = screen.getByRole('img')

    // Two fixed columns below `sm`, four above it. A grid is what makes the
    // break structural: four bars are 2 × 2 on a phone and 1 × 4 on the panel,
    // and no width of chord symbol can produce 3 + 1.
    expect(sheet.className).toMatch(/\bgrid\b/)
    expect(sheet.className).toMatch(/\bgrid-cols-2\b/)
    expect(sheet.className).toMatch(/\bsm:grid-cols-4\b/)
    expect(sheet.className).not.toMatch(/overflow-x/)

    // Nothing may reintroduce per-item wrapping, which is what decides 3 + 1.
    expect(sheet.className).not.toMatch(/\bflex-wrap\b/)
    for (const bar of bars(container)) {
      expect(bar.className).not.toContain('basis-')
    }
  })

  // --- Step C8 — R8, AC8 ---------------------------------------------------

  it('takes its ink from the surface, fixing no colour of its own (R8, AC8)', () => {
    const { container } = render(<LeadSheet chords={CHANGES} />)

    for (const element of container.querySelectorAll<HTMLElement>('*')) {
      expect(element.className).not.toMatch(/text-(text|on-accent|accent|warm)/)
      expect(element.className).not.toMatch(/#[0-9a-f]{3,8}/i)
      expect(element).not.toHaveAttribute('fill')
      expect(element).not.toHaveAttribute('stroke')
    }
  })

  // --- Totality: the sheet draws whatever it is handed ----------------------

  it('draws a repeated bar as a repeat, not as a gap (R2 via barChords, AC2)', () => {
    const { container } = render(
      <LeadSheet chords={['Em7', 'Bm7', 'C♯m7♭5', 'Em7']} />,
    )

    expect(bars(container).map((bar) => bar.textContent)).toEqual([
      'Em7',
      'Bm7',
      'C♯m7♭5',
      'Em7',
    ])
  })

  it('draws four empty bars rather than nothing when the chords are blank (R3)', () => {
    const { container } = render(<LeadSheet chords={['', '', '', '']} />)

    expect(bars(container)).toHaveLength(4)
    expect(screen.getByRole('img')).toBeInTheDocument()
  })
})
