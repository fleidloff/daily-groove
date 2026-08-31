import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { ScaleStaff } from './ScaleStaff'
import type { StaffNote } from '../../lib/theory/staff'

/**
 * Hand-written positions, not `staffNotes` output. The drawing's contract is
 * `StaffNote[]`, so it is tested against the contract — a change to the mapping
 * cannot make this file go red, and a change to the drawing cannot hide behind
 * the mapping being right.
 */
function fixture(...pairs: [step: number, accidental: string][]): StaffNote[] {
  return pairs.map(([step, accidental]) => ({ step, accidental }))
}

/** E Dorian: E F♯ G A B C♯ D, ascending from E4. */
const E_DORIAN = fixture(
  [2, ''],
  [3, '♯'],
  [4, ''],
  [5, ''],
  [6, ''],
  [7, '♯'],
  [8, ''],
)

const E_DORIAN_LABEL = 'E F♯ G A B C♯ D'

/** C Blues: C E♭ F G♭ G B♭ — the G♭ and the G share step 4. */
const C_BLUES = fixture([0, ''], [2, '♭'], [3, ''], [4, '♭'], [4, '♮'], [6, '♭'])

/** Inside the five lines: E4 (step 2) to F5 (step 10) inclusive. */
const INSIDE_THE_STAFF = fixture([2, ''], [4, ''], [6, ''], [8, ''], [10, ''])

function noteheads(): SVGEllipseElement[] {
  return screen.getAllByTestId('notehead') as unknown as SVGEllipseElement[]
}

function accidentals(): SVGTextElement[] {
  return screen.queryAllByTestId('accidental') as unknown as SVGTextElement[]
}

function num(element: Element, attribute: string): number {
  const raw = element.getAttribute(attribute)
  expect(raw, `${element.tagName} is missing ${attribute}`).not.toBeNull()
  return Number(raw)
}

/**
 * The horizontal box an accidental can occupy, read off the element rather
 * than off the component's constants. The glyphs are end-anchored at their `x`,
 * and no accidental is wider than its own em box, so `font-size` per character
 * is the bound that holds whatever face the browser resolves — which is the
 * safe direction for an assertion that two glyphs do not touch.
 */
function span(element: Element): [left: number, right: number] {
  const right = num(element, 'x')
  const em = num(element, 'font-size') * (element.textContent ?? '').length
  return [right - em, right]
}

function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1]
}

describe('ScaleStaff', () => {
  describe('the ruled staff (B1)', () => {
    it('draws five lines and one clef before any note is placed (R1, R1b)', () => {
      render(<ScaleStaff notes={[]} label="" />)

      expect(screen.getAllByTestId('staff-line')).toHaveLength(5)
      expect(screen.getByTestId('clef')).toBeInTheDocument()
      expect(screen.queryAllByTestId('notehead')).toHaveLength(0)
    })

    it('rules the five lines evenly and horizontally (R1)', () => {
      render(<ScaleStaff notes={[]} label="" />)

      const lines = screen.getAllByTestId('staff-line')
      const ys = lines.map((line) => num(line, 'y1'))

      lines.forEach((line) => {
        expect(num(line, 'y1')).toBe(num(line, 'y2'))
      })

      const gaps = ys.slice(1).map((y, i) => Math.abs(y - ys[i]))
      gaps.forEach((gap) => expect(gap).toBe(gaps[0]))
      expect(gaps[0]).toBeGreaterThan(0)
    })

    it('draws the clef as a single drawn path, not a font glyph (R1b)', () => {
      render(<ScaleStaff notes={[]} label="" />)

      const clef = screen.getByTestId('clef')
      expect(clef.tagName.toLowerCase()).toBe('path')
      expect(clef.getAttribute('d')).toMatch(/^M/)
      expect(clef.textContent).toBe('')
    })

    it('stays static: no control, no animation, no transition (R12)', () => {
      const { container } = render(
        <ScaleStaff notes={E_DORIAN} label={E_DORIAN_LABEL} />,
      )

      expect(screen.queryAllByRole('button')).toHaveLength(0)
      expect(container.innerHTML).not.toMatch(/animate-|transition|duration-/)
    })
  })

  describe('the noteheads (B2)', () => {
    it('draws one notehead per note, left to right (R1, AC1)', () => {
      render(<ScaleStaff notes={E_DORIAN} label={E_DORIAN_LABEL} />)

      const xs = noteheads().map((note) => num(note, 'cx'))

      expect(xs).toHaveLength(7)
      xs.slice(1).forEach((x, i) => expect(x).toBeGreaterThan(xs[i]))
    })

    it('places a higher step higher on the page (R1, AC1)', () => {
      render(<ScaleStaff notes={E_DORIAN} label={E_DORIAN_LABEL} />)

      const ys = noteheads().map((note) => num(note, 'cy'))

      ys.slice(1).forEach((y, i) => expect(y).toBeLessThan(ys[i]))
    })

    it('spaces one diatonic step at half the gap between two lines (R1)', () => {
      render(<ScaleStaff notes={INSIDE_THE_STAFF} label="E G B D F" />)

      const lines = screen.getAllByTestId('staff-line')
      const space = Math.abs(num(lines[1], 'y1') - num(lines[0], 'y1'))
      const ys = noteheads().map((note) => num(note, 'cy'))

      // The fixture steps two at a time — line to line.
      ys.slice(1).forEach((y, i) => expect(ys[i] - y).toBe(space))
    })

    it('sits the notes on the lines the clef names (R1b)', () => {
      render(<ScaleStaff notes={INSIDE_THE_STAFF} label="E G B D F" />)

      const lineYs = screen
        .getAllByTestId('staff-line')
        .map((line) => num(line, 'y1'))
        .sort((a, b) => a - b)
      const noteYs = noteheads()
        .map((note) => num(note, 'cy'))
        .sort((a, b) => a - b)

      expect(noteYs).toEqual(lineYs)
    })
  })

  describe('the accidentals (B3)', () => {
    const MIXED = fixture([2, '♭'], [4, ''], [5, '♯'], [7, '♮'])

    it('draws one accidental per altered note and none for the rest (R2)', () => {
      render(<ScaleStaff notes={MIXED} label="E♭ G A♯ C♮" />)

      expect(accidentals()).toHaveLength(3)
    })

    it('sets each accidental to the left of its notehead, level with it (R2)', () => {
      render(<ScaleStaff notes={MIXED} label="E♭ G A♯ C♮" />)

      const notes = noteheads()
      const glyphs = accidentals()
      // The unaltered note is the second of four; the glyphs belong to 0, 2, 3.
      const owners = [notes[0], notes[2], notes[3]]

      glyphs.forEach((glyph, i) => {
        const [, right] = span(glyph)
        expect(right).toBeLessThan(num(owners[i], 'cx'))
        expect(num(glyph, 'y')).toBe(num(owners[i], 'cy'))
      })
    })

    it('renders ♯, ♭ and ♮ as those characters, not as a fallback box (R8)', () => {
      render(<ScaleStaff notes={MIXED} label="E♭ G A♯ C♮" />)

      expect(accidentals().map((glyph) => glyph.textContent)).toEqual([
        '♭',
        '♯',
        '♮',
      ])
    })

    it('letters the accidentals in the jazz face (R8)', () => {
      render(<ScaleStaff notes={MIXED} label="E♭ G A♯ C♮" />)

      accidentals().forEach((glyph) => {
        expect(glyph.getAttribute('class') ?? '').toMatch(/font-jazz/)
      })
    })

    it('gives a double accidental a slot two characters wide (R2)', () => {
      render(
        <ScaleStaff notes={fixture([3, '♯'], [10, '♯♯'])} label="F♯ F♯♯" />,
      )

      const [single, double] = accidentals()
      expect(double.textContent).toBe('♯♯')

      const [, singleRight] = span(single)
      const [, doubleRight] = span(double)
      expect(singleRight - span(single)[0]).toBeGreaterThan(0)
      expect(doubleRight - span(double)[0]).toBe(
        2 * (singleRight - span(single)[0]),
      )
    })
  })

  describe('two notes on one line (B4)', () => {
    it('keeps the shared step but separates the noteheads (R4, AC2)', () => {
      render(<ScaleStaff notes={C_BLUES} label="C E♭ F G♭ G B♭" />)

      const notes = noteheads()
      expect(notes).toHaveLength(6)

      const flat = notes[3]
      const natural = notes[4]

      expect(num(natural, 'cy')).toBe(num(flat, 'cy'))
      expect(num(natural, 'cx') - num(flat, 'cx')).toBeGreaterThanOrEqual(
        2 * num(flat, 'rx'),
      )
    })

    it('gives the second of the pair more room than an ordinary step (R4)', () => {
      render(<ScaleStaff notes={C_BLUES} label="C E♭ F G♭ G B♭" />)

      const xs = noteheads().map((note) => num(note, 'cx'))
      const shared = xs[4] - xs[3]
      const ordinary = xs[3] - xs[2]

      expect(shared).toBeGreaterThan(ordinary)
    })

    it('keeps the ♭ and the ♮ from overlapping each other (R4, AC2)', () => {
      render(<ScaleStaff notes={C_BLUES} label="C E♭ F G♭ G B♭" />)

      const glyphs = accidentals()
      // C E♭ F G♭ G B♭ — four altered notes, the middle two on one line.
      expect(glyphs.map((glyph) => glyph.textContent)).toEqual([
        '♭',
        '♭',
        '♮',
        '♭',
      ])

      expect(overlaps(span(glyphs[1]), span(glyphs[2]))).toBe(false)
    })

    it('keeps the ♮ clear of the notehead it follows (R4, AC2)', () => {
      render(<ScaleStaff notes={C_BLUES} label="C E♭ F G♭ G B♭" />)

      const flat = noteheads()[3]
      const natural = accidentals()[2]
      const flatBox: [number, number] = [
        num(flat, 'cx') - num(flat, 'rx'),
        num(flat, 'cx') + num(flat, 'rx'),
      ]

      expect(overlaps(span(natural), flatBox)).toBe(false)
    })
  })

  describe('ledger lines (B5)', () => {
    it('rules a ledger under a note above the staff (R5, AC4)', () => {
      // A5 is step 12: the top line, F5, is step 10.
      render(<ScaleStaff notes={fixture([12, ''])} label="A" />)

      const note = noteheads()[0]
      const ledgers = screen.getAllByTestId('ledger')

      expect(ledgers.length).toBeGreaterThanOrEqual(1)
      const atTheNote = ledgers.filter(
        (ledger) => num(ledger, 'y1') === num(note, 'cy'),
      )
      expect(atTheNote).toHaveLength(1)

      const ledger = atTheNote[0]
      expect(num(ledger, 'x1')).toBeLessThan(num(note, 'cx'))
      expect(num(ledger, 'x2')).toBeGreaterThan(num(note, 'cx'))
      expect(num(ledger, 'x2') - num(ledger, 'x1')).toBeGreaterThan(
        2 * num(note, 'rx'),
      )
    })

    it('rules a ledger over a note below the staff (R5, AC4)', () => {
      // C4 is step 0: the bottom line, E4, is step 2.
      render(<ScaleStaff notes={fixture([0, ''])} label="C" />)

      const note = noteheads()[0]
      const ledgers = screen.getAllByTestId('ledger')

      expect(
        ledgers.filter((ledger) => num(ledger, 'y1') === num(note, 'cy')),
      ).toHaveLength(1)
    })

    it('rules every line between the staff and a far note (R5, AC4)', () => {
      // C6 is step 14: two ledgers, A5 (12) and C6 (14).
      render(<ScaleStaff notes={fixture([14, ''])} label="C" />)

      expect(screen.getAllByTestId('ledger')).toHaveLength(2)
    })

    it('rules none for a scale that stays inside the lines (R5, AC4)', () => {
      render(<ScaleStaff notes={INSIDE_THE_STAFF} label="E G B D F" />)

      expect(screen.queryAllByTestId('ledger')).toHaveLength(0)
    })
  })

  describe('what a screen reader gets (B6)', () => {
    it('reads as one image named by its notes, in order (R7, AC5)', () => {
      render(<ScaleStaff notes={E_DORIAN} label={E_DORIAN_LABEL} />)

      expect(
        screen.getByRole('img', { name: E_DORIAN_LABEL }),
      ).toBeInTheDocument()
    })

    it('announces nothing inside the drawing separately (R7, AC5)', () => {
      render(<ScaleStaff notes={E_DORIAN} label={E_DORIAN_LABEL} />)

      const staff = screen.getByRole('img', { name: E_DORIAN_LABEL })

      expect(screen.getAllByRole('img')).toHaveLength(1)
      expect(staff.querySelectorAll('[role], [aria-label]')).toHaveLength(0)
    })
  })

  describe('ink and fit (B7)', () => {
    it('takes every stroke and fill from currentColor (R9, AC8)', () => {
      const { container } = render(
        <ScaleStaff notes={C_BLUES} label="C E♭ F G♭ G B♭" />,
      )

      const drawn = Array.from(
        container.querySelectorAll('line, ellipse, path, text'),
      )
      expect(drawn.length).toBeGreaterThan(0)

      drawn.forEach((element) => {
        const stroke = element.getAttribute('stroke')
        const fill = element.getAttribute('fill')

        // `none` switches a channel off — an open notehead is drawn, not
        // filled — which is not the same as naming a colour. Whatever ink an
        // element does use has to be the surface's.
        const inks = [stroke, fill].filter((v) => v !== null && v !== 'none')
        expect(inks.length, `${element.tagName} sets no ink`).toBeGreaterThan(0)
        for (const ink of inks) expect(ink).toBe('currentColor')
      })
    })

    it('names no colour class anywhere in the drawing (R9, AC8)', () => {
      const { container } = render(
        <ScaleStaff notes={C_BLUES} label="C E♭ F G♭ G B♭" />,
      )

      Array.from(container.querySelectorAll('*')).forEach((element) => {
        expect(element.getAttribute('class') ?? '').not.toMatch(
          /(^|\s)(text-(?!\[)|bg-|fill-|stroke-|border-)/,
        )
      })
    })

    it('draws at its natural size and shrinks only to fit (R10, AC8)', () => {
      const { container } = render(
        <ScaleStaff notes={E_DORIAN} label={E_DORIAN_LABEL} />,
      )

      const svg = container.querySelector('svg')
      expect(svg).not.toBeNull()

      // One viewBox unit is one pixel, so a staff space is the same size on
      // every day's scale. Stretched to the panel's width it would read as a
      // diagram of a staff rather than as notation.
      const viewBox = svg!.getAttribute('viewBox')
      expect(viewBox).toMatch(/^0 0 \d+(\.\d+)? \d+/)
      const [, , vbWidth, vbHeight] = viewBox!.split(' ')
      expect(svg!.getAttribute('width')).toBe(vbWidth)
      expect(svg!.getAttribute('height')).toBe(vbHeight)

      // …but it still fits a narrower column, by scaling down as a whole.
      expect(svg!.getAttribute('class') ?? '').toMatch(/\bmax-w-full\b/)
      expect(svg!.getAttribute('class') ?? '').toMatch(/\bh-auto\b/)
      // Anchored on a space: `\b` would match inside `max-w-full`.
      expect(svg!.getAttribute('class') ?? '').not.toMatch(/(^|\s)w-full\b/)
    })

    it('keeps a staff space the same size whatever the note count (R10)', () => {
      const seven = render(
        <ScaleStaff notes={E_DORIAN} label={E_DORIAN_LABEL} />,
      ).container.querySelector('svg')!
      const six = render(
        <ScaleStaff notes={C_BLUES} label="C E♭ F G♭ G B♭" />,
      ).container.querySelector('svg')!

      // Same height in the same units: only the width follows the note count,
      // so a six-note blues scale is not drawn larger than a seven-note mode.
      expect(six.getAttribute('height')).toBe(seven.getAttribute('height'))
      expect(Number(six.getAttribute('width'))).toBeLessThan(
        Number(seven.getAttribute('width')),
      )
    })

    it('keeps every note inside the viewBox at any width (R10)', () => {
      render(<ScaleStaff notes={C_BLUES} label="C E♭ F G♭ G B♭" />)

      const svg = screen
        .getByRole('img', { name: 'C E♭ F G♭ G B♭' })
        .closest('svg')!
      const [, , width, height] = svg
        .getAttribute('viewBox')!
        .split(' ')
        .map(Number)

      noteheads().forEach((note) => {
        expect(num(note, 'cx') + num(note, 'rx')).toBeLessThanOrEqual(width)
        expect(num(note, 'cy') + num(note, 'ry')).toBeLessThanOrEqual(height)
        expect(num(note, 'cy') - num(note, 'ry')).toBeGreaterThanOrEqual(0)
      })

      accidentals().forEach((glyph) => {
        expect(span(glyph)[0]).toBeGreaterThanOrEqual(0)
      })
    })
  })
})

