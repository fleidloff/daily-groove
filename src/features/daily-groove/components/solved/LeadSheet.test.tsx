import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { LeadSheet } from './LeadSheet'

const CHANGES = ['C7', 'Em7♭5', 'B♭maj7', 'Fmaj7']

/** `groove-01`'s real degrees, as Track B's `barNumerals` writes them. */
const NUMERALS = ['I', 'III', '♭VII', 'IV']

/** The bar elements, in document order. */
function bars(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-bar]'))
}

/** The numeral elements, in document order. */
function numerals(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-numeral]'))
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

  it('adds the numerals and still nothing else — no title, key or tempo (R5)', () => {
    const { container } = render(
      <LeadSheet chords={CHANGES} numerals={NUMERALS} />,
    )

    // Four symbols and four numerals, interleaved bar by bar, and no other
    // word on the page: the numeral is the only thing this epic adds.
    expect(container.textContent).toBe(
      CHANGES.map((chord, bar) => `${chord}${NUMERALS[bar]}`).join(''),
    )
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

  // --- Step C1 — R1, AC1 ---------------------------------------------------

  it('draws one numeral under each bar, in bar order (R1, AC1)', () => {
    const { container } = render(
      <LeadSheet chords={CHANGES} numerals={NUMERALS} />,
    )

    for (const bar of bars(container)) {
      expect(bar.querySelectorAll('[data-numeral]')).toHaveLength(1)
    }
    expect(numerals(container).map((numeral) => numeral.textContent)).toEqual(
      NUMERALS,
    )
  })

  // --- Step C2 — R7, AC9 ---------------------------------------------------

  it('sits in the air the bar already reserves, changing no geometry (R7, AC9)', () => {
    const plain = render(<LeadSheet chords={CHANGES} />).container
    const withNumerals = render(
      <LeadSheet chords={CHANGES} numerals={NUMERALS} />,
    ).container

    // Not a list of utilities to keep in step: the claim is that a bar drawn
    // with a numeral is the same box as a bar drawn without one. The moment the
    // numeral is put in flow and the padding is grown to make room, this fails.
    const classes = bars(withNumerals).map((bar) => bar.className)
    expect(classes).toEqual(bars(plain).map((bar) => bar.className))
    for (const className of classes) {
      expect(className).toMatch(/\bpb-9\b/)
      expect(className).toMatch(/\bpl-3\b/)
      expect(className).toMatch(/\bpt-1\b/)
      expect(className).toMatch(/\brelative\b/)
      expect(className).toMatch(/\bborder-l\b/)
    }
  })

  it('keeps the two-by-two break the grid guarantees (R7, AC9)', () => {
    const { container } = render(
      <LeadSheet chords={CHANGES} numerals={NUMERALS} />,
    )
    const sheet = within(container).getByRole('img')

    expect(sheet.className).toMatch(/\bgrid-cols-2\b/)
    expect(sheet.className).toMatch(/\bsm:grid-cols-4\b/)
    expect(sheet.className).not.toMatch(/\bflex-wrap\b/)
  })

  it('holds each numeral inside its own bar, whatever the layout (R7, AC9)', () => {
    const { container } = render(
      <LeadSheet chords={CHANGES} numerals={NUMERALS} />,
    )
    const drawn = bars(container)
    const drawnNumerals = numerals(container)

    expect(drawnNumerals).toHaveLength(drawn.length)
    for (const numeral of drawnNumerals) {
      expect(numeral.className).toMatch(/\babsolute\b/)
      expect(numeral.className).toMatch(/\bleft-3\b/)
      expect(numeral.className).toMatch(/\bbottom-/)
    }
    // jsdom resolves no media query, so the 2 × 2 break itself is checked by
    // eye. Containment is the layout-independent half of the same claim.
    drawn.forEach((bar, index) => {
      drawnNumerals.forEach((numeral, other) => {
        expect(bar.contains(numeral)).toBe(index === other)
      })
    })
  })

  // --- Step C3 — R5 --------------------------------------------------------

  it('letters the numerals in the same hand, one size under the symbol (R5)', () => {
    const { container } = render(
      <LeadSheet chords={CHANGES} numerals={NUMERALS} />,
    )

    for (const numeral of NUMERALS) {
      const lettering = within(container).getByText(numeral)
      expect(lettering.className).toMatch(/font-jazz/)
      // `Lettering size="sm"` — smaller than the symbol's `md` above it.
      expect(lettering.className).toMatch(/text-\[15px\]/)
    }
  })

  // --- Step C4 — R4a, R8, AC7 ----------------------------------------------

  it('draws no numeral where a bar has none, and keeps the bar (R4a, R8, AC7)', () => {
    const { container } = render(
      <LeadSheet chords={CHANGES} numerals={['I', '', '', 'IV']} />,
    )
    const drawn = bars(container)

    expect(drawn).toHaveLength(4)
    expect(drawn[1].querySelectorAll('[data-numeral]')).toHaveLength(0)
    expect(drawn[2].querySelectorAll('[data-numeral]')).toHaveLength(0)
    expect(drawn[1].textContent).toBe('Em7♭5')
    expect(drawn[2].textContent).toBe('B♭maj7')
    expect(numerals(container).map((numeral) => numeral.textContent)).toEqual([
      'I',
      'IV',
    ])
  })

  it('draws four bars and no numerals when the prop is absent (R4a, R8, AC7)', () => {
    const { container } = render(<LeadSheet chords={CHANGES} />)

    expect(bars(container)).toHaveLength(4)
    expect(numerals(container)).toHaveLength(0)
    expect(
      screen.getByRole('img', { name: 'C7 · Em7♭5 · B♭maj7 · Fmaj7' }),
    ).toBeInTheDocument()
  })

  it('draws numerals over blank bars rather than throwing (R4a, R8, AC7)', () => {
    expect(() =>
      render(
        <LeadSheet chords={['', '', '', '']} numerals={['I', 'V', 'I', 'V']} />,
      ),
    ).not.toThrow()
  })

  // --- Step C5 — R1, AC1 ---------------------------------------------------

  it('reads each bar as its symbol and its numeral to a screen reader (R1, AC1)', () => {
    render(<LeadSheet chords={CHANGES} numerals={NUMERALS} />)

    // `role="img"` hides the subtree, so a numeral left out of the accessible
    // name is a numeral no screen-reader user ever hears.
    expect(
      screen.getByRole('img', {
        name: 'C7 I · Em7♭5 III · B♭maj7 ♭VII · Fmaj7 IV',
      }),
    ).toBeInTheDocument()
  })

  it('names only the bars that have a numeral (R1, R8, AC1, AC7)', () => {
    render(<LeadSheet chords={CHANGES} numerals={['I', '', '', 'IV']} />)

    expect(
      screen.getByRole('img', { name: 'C7 I · Em7♭5 · B♭maj7 · Fmaj7 IV' }),
    ).toBeInTheDocument()
  })
})
