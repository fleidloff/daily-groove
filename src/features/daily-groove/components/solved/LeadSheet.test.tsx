import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { LeadSheet } from './LeadSheet'
import { GROOVES } from '../../data/grooves.generated'
import { barChords } from '../../lib/theory/changes'

const CHANGES = ['C7', 'Em7♭5', 'B♭maj7', 'Fmaj7']

const NUMERALS = ['I', 'III', '♭VII', 'IV']

const SYMBOLS = [
  ...new Set(GROOVES.flatMap((groove) => barChords(groove.progression))),
].filter(Boolean)

const widest = Math.max(...SYMBOLS.map((symbol) => [...symbol].length))

const WIDEST = SYMBOLS.filter((symbol) => [...symbol].length === widest)

function bars(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-bar]'))
}

function numerals(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-numeral]'))
}

function expectNothingClips(container: HTMLElement): void {
  for (const element of container.querySelectorAll<HTMLElement>('*')) {
    expect(element.className).not.toMatch(/\btruncate\b/)
    expect(element.className).not.toMatch(/\btext-ellipsis\b/)
    expect(element.className).not.toMatch(/\boverflow-hidden\b/)
    expect(element.className).not.toMatch(/\bline-clamp/)
  }
}

describe('LeadSheet', () => {
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

  it("sets the symbol one step smaller below sm and feature-11's size above it (F17 E3 R2, R5, AC2, AC5)", () => {
    const { container } = render(<LeadSheet chords={CHANGES} />)
    const symbol = within(container).getByText('C7').className

    expect(symbol).toContain('text-[15px]')
    expect(symbol).toContain('sm:text-[20px]')
    expect(symbol).not.toMatch(/(?<!sm:)text-\[20px\]/)
  })

  it('is a drawing, not a control: nothing to press and nothing to focus (R12)', () => {
    const { container } = render(<LeadSheet chords={CHANGES} />)

    expect(within(container).queryAllByRole('button')).toHaveLength(0)
    expect(container.querySelectorAll('[tabindex]')).toHaveLength(0)
  })

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

    expect(sheet.className).toMatch(/border-r-\[3px\]/)
    const thin = sheet.querySelector(':scope > [data-double-bar]')
    expect(thin).not.toBeNull()
    expect((thin as HTMLElement).className).toMatch(/\bborder-r\b/)
    expect((thin as HTMLElement).className).toMatch(/\binset-y-0\b/)

    for (const bar of drawn) {
      expect(bar.className).not.toMatch(/border-r/)
      expect(bar.querySelector('[data-double-bar]')).toBeNull()
    }
  })

  it('carries no stave and no rhythm slashes (R5a, AC5a)', () => {
    const { container } = render(<LeadSheet chords={CHANGES} />)

    expect(container.querySelector('svg')).toBeNull()
    expect(container.innerHTML).not.toMatch(/stave|staff|slash/i)
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

    expect(container.textContent).toBe(
      CHANGES.map((chord, bar) => `${chord}${NUMERALS[bar]}`).join(''),
    )
  })

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

  it('keeps four bars in one row at every width (F17 E3 R1, AC1)', () => {
    const { container } = render(<LeadSheet chords={CHANGES} />)
    const sheet = screen.getByRole('img')

    expect(sheet.className).toMatch(/\bgrid\b/)
    expect(sheet.className).toMatch(/\bgrid-cols-4\b/)
    expect(sheet.className).not.toMatch(/\bgrid-cols-2\b/)
    expect(sheet.className).not.toMatch(/\bsm:grid-cols-/)
    expect(sheet.className).not.toMatch(/overflow-x/)

    expect(sheet.className).not.toMatch(/\bflex-wrap\b/)
    for (const bar of bars(container)) {
      expect(bar.className).not.toContain('basis-')
    }
  })

  it('takes its ink from the surface, fixing no colour of its own (R8, AC8)', () => {
    const { container } = render(<LeadSheet chords={CHANGES} />)

    for (const element of container.querySelectorAll<HTMLElement>('*')) {
      expect(element.className).not.toMatch(/text-(text|on-accent|accent|warm)/)
      expect(element.className).not.toMatch(/#[0-9a-f]{3,8}/i)
      expect(element).not.toHaveAttribute('fill')
      expect(element).not.toHaveAttribute('stroke')
    }
  })

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

  it('sits in the air the bar already reserves, changing no geometry (R7, AC9)', () => {
    const plain = render(<LeadSheet chords={CHANGES} />).container
    const withNumerals = render(
      <LeadSheet chords={CHANGES} numerals={NUMERALS} />,
    ).container

    const classes = bars(withNumerals).map((bar) => bar.className)
    expect(classes).toEqual(bars(plain).map((bar) => bar.className))
    for (const className of classes) {
      expect(className).toMatch(/\bpb-9\b/)
      expect(className).toMatch(/\bpl-1\b/)
      expect(className).toMatch(/\bsm:pl-3\b/)
      expect(className).toMatch(/\bpr-1\b/)
      expect(className).toMatch(/\bsm:pr-4\b/)
      expect(className).toMatch(/\bpt-1\b/)
      expect(className).toMatch(/\brelative\b/)
      expect(className).toMatch(/\bborder-l\b/)
    }
  })

  it('never breaks a chord symbol across two lines (F17 E3 R3)', () => {
    const { container } = render(<LeadSheet chords={CHANGES} />)

    for (const bar of bars(container)) {
      expect(bar.className).toMatch(/\bwhitespace-nowrap\b/)
    }
  })

  it('keeps the one-row grid with the numerals drawn (F17 E3 R1, R4, AC1, AC4)', () => {
    const { container } = render(
      <LeadSheet chords={CHANGES} numerals={NUMERALS} />,
    )
    const sheet = within(container).getByRole('img')

    expect(sheet.className).toMatch(/\bgrid-cols-4\b/)
    expect(sheet.className).not.toMatch(/\bgrid-cols-2\b/)
    expect(sheet.className).not.toMatch(/\bsm:grid-cols-/)
    expect(sheet.className).not.toMatch(/\bflex-wrap\b/)
    expect(numerals(container)).toHaveLength(4)
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
      expect(numeral.className).toMatch(/\bleft-1\b/)
      expect(numeral.className).toMatch(/\bsm:left-3\b/)
      expect(numeral.className).toMatch(/\bbottom-/)
    }
    drawn.forEach((bar, index) => {
      drawnNumerals.forEach((numeral, other) => {
        expect(bar.contains(numeral)).toBe(index === other)
      })
    })
  })

  it('letters the numerals in the same hand, one size under the symbol (R5)', () => {
    const { container } = render(
      <LeadSheet chords={CHANGES} numerals={NUMERALS} />,
    )

    for (const numeral of NUMERALS) {
      const lettering = within(container).getByText(numeral)
      expect(lettering.className).toMatch(/font-jazz/)
      expect(lettering.className).toContain('text-[13px]')
      expect(lettering.className).toContain('sm:text-[15px]')
    }
  })

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

  it('reads each bar as its symbol and its numeral to a screen reader (R1, AC1)', () => {
    render(<LeadSheet chords={CHANGES} numerals={NUMERALS} />)

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

  describe('the widest symbol the catalogue can produce (F17 E3 R3, AC3)', () => {
    it('derives at least one widest symbol from the shipped manifest', () => {
      expect(WIDEST.length).toBeGreaterThan(0)
      expect(widest, WIDEST.join(' ')).toBe(7)
    })

    it.each(WIDEST)('draws %s whole in bar one', (symbol) => {
      const { container } = render(
        <LeadSheet chords={[symbol, 'C7', 'C7', 'C7']} />,
      )
      const bar = bars(container)[0]

      expect(bar.textContent).toBe(symbol)
      expect(within(bar).getByText(symbol).childNodes).toHaveLength(1)
      expectNothingClips(container)
    })

    it.each(WIDEST)('draws %s whole in bar four', (symbol) => {
      const { container } = render(
        <LeadSheet chords={['C7', 'C7', 'C7', symbol]} />,
      )
      const bar = bars(container)[3]

      expect(bar.textContent).toBe(symbol)
      expect(within(bar).getByText(symbol).childNodes).toHaveLength(1)
      expectNothingClips(container)
    })
  })
})
