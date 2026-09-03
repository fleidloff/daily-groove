import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { ScaleStaff } from './ScaleStaff'
import type { StaffNote } from '@/lib/theory/staff'

function fixture(...pairs: [step: number, accidental: string][]): StaffNote[] {
  return pairs.map(([step, accidental]) => ({ step, accidental }))
}

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

const C_BLUES = fixture([0, ''], [2, '♭'], [3, ''], [4, '♭'], [4, '♮'], [6, '♭'])

const C_BLUES_DEGREES = ['1', '♭3', '4', '♭5', '5', '♭7']

const INSIDE_THE_STAFF = fixture([2, ''], [4, ''], [6, ''], [8, ''], [10, ''])

const ON_THE_FLOOR = fixture(
  [0, ''],
  [1, ''],
  [2, ''],
  [3, ''],
  [4, ''],
  [5, ''],
  [6, ''],
)

const ABOVE_THE_FLOOR = fixture(
  [4, ''],
  [5, ''],
  [6, ''],
  [7, ''],
  [8, ''],
  [9, ''],
  [10, ''],
)

function noteheads(): SVGEllipseElement[] {
  return screen.getAllByTestId('notehead') as unknown as SVGEllipseElement[]
}

function accidentals(): SVGTextElement[] {
  return screen.queryAllByTestId('accidental') as unknown as SVGTextElement[]
}

function degrees(): SVGTextElement[] {
  return screen.queryAllByTestId('degree') as unknown as SVGTextElement[]
}

function stems(): SVGLineElement[] {
  return screen.queryAllByTestId('stem') as unknown as SVGLineElement[]
}

const MIDDLE_LINE_STEP = 6

function degreesFor(notes: StaffNote[]): string[] {
  return notes.map((_, i) => String(i + 1))
}

function num(element: Element, attribute: string): number {
  const raw = element.getAttribute(attribute)
  expect(raw, `${element.tagName} is missing ${attribute}`).not.toBeNull()
  return Number(raw)
}

function span(element: Element): [left: number, right: number] {
  const right = num(element, 'x')
  const em = num(element, 'font-size') * (element.textContent ?? '').length
  return [right - em, right]
}

function centredSpan(element: Element): [left: number, right: number] {
  const centre = num(element, 'x')
  const em = num(element, 'font-size') * (element.textContent ?? '').length
  return [centre - em / 2, centre + em / 2]
}

function overlaps(a: [number, number], b: [number, number]): boolean {
  return a[0] < b[1] && b[0] < a[1]
}

describe('ScaleStaff', () => {
  describe('the ruled staff (B1)', () => {
    it('draws five lines and one clef before any note is placed (R1, R1b)', () => {
      render(<ScaleStaff notes={[]} label="" degrees={degreesFor([])} />)

      expect(screen.getAllByTestId('staff-line')).toHaveLength(5)
      expect(screen.getByTestId('clef')).toBeInTheDocument()
      expect(screen.queryAllByTestId('notehead')).toHaveLength(0)
    })

    it('rules the five lines evenly and horizontally (R1)', () => {
      render(<ScaleStaff notes={[]} label="" degrees={degreesFor([])} />)

      const lines = screen.getAllByTestId('staff-line')
      const ys = lines.map((line) => num(line, 'y1'))

      lines.forEach((line) => {
        expect(num(line, 'y1')).toBe(num(line, 'y2'))
      })

      const gaps = ys.slice(1).map((y, i) => Math.abs(y - ys[i]))
      gaps.forEach((gap) => expect(gap).toBe(gaps[0]))
      expect(gaps[0]).toBeGreaterThan(0)
    })

    it('draws the clef as path data, not as text a font renders (R1b)', () => {
      render(<ScaleStaff notes={[]} label="" degrees={degreesFor([])} />)

      const clef = screen.getByTestId('clef')
      expect(clef.tagName.toLowerCase()).toBe('path')
      expect(clef.getAttribute('d')).toMatch(/^M/)
      expect(clef.textContent).toBe('')
      expect(clef.getAttribute('fill')).toBe('currentColor')
      expect(clef.getAttribute('stroke')).toBeNull()
    })

    it('stays static: no control, no animation, no transition (R12)', () => {
      const { container } = render(
        <ScaleStaff
          notes={E_DORIAN}
          label={E_DORIAN_LABEL}
          degrees={degreesFor(E_DORIAN)}
        />,
      )

      expect(screen.queryAllByRole('button')).toHaveLength(0)
      expect(container.innerHTML).not.toMatch(/animate-|transition|duration-/)
    })
  })

  describe('the noteheads (B2)', () => {
    it('draws one notehead per note, left to right (R1, AC1)', () => {
      render(
        <ScaleStaff
          notes={E_DORIAN}
          label={E_DORIAN_LABEL}
          degrees={degreesFor(E_DORIAN)}
        />,
      )

      const xs = noteheads().map((note) => num(note, 'cx'))

      expect(xs).toHaveLength(7)
      xs.slice(1).forEach((x, i) => expect(x).toBeGreaterThan(xs[i]))
    })

    it('places a higher step higher on the page (R1, AC1)', () => {
      render(
        <ScaleStaff
          notes={E_DORIAN}
          label={E_DORIAN_LABEL}
          degrees={degreesFor(E_DORIAN)}
        />,
      )

      const ys = noteheads().map((note) => num(note, 'cy'))

      ys.slice(1).forEach((y, i) => expect(y).toBeLessThan(ys[i]))
    })

    it('spaces one diatonic step at half the gap between two lines (R1)', () => {
      render(
        <ScaleStaff
          notes={INSIDE_THE_STAFF}
          label="E G B D F"
          degrees={degreesFor(INSIDE_THE_STAFF)}
        />,
      )

      const lines = screen.getAllByTestId('staff-line')
      const space = Math.abs(num(lines[1], 'y1') - num(lines[0], 'y1'))
      const ys = noteheads().map((note) => num(note, 'cy'))

      ys.slice(1).forEach((y, i) => expect(ys[i] - y).toBe(space))
    })

    it('sits the notes on the lines the clef names (R1b)', () => {
      render(
        <ScaleStaff
          notes={INSIDE_THE_STAFF}
          label="E G B D F"
          degrees={degreesFor(INSIDE_THE_STAFF)}
        />,
      )

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

    it('draws a stem for every note, meeting its head (F15 drawing)', () => {
    render(<ScaleStaff notes={ON_THE_FLOOR} label="" degrees={degreesFor(ON_THE_FLOOR)} />)

    expect(stems()).toHaveLength(ON_THE_FLOOR.length)
    stems().forEach((stem, i) => {
      const head = noteheads()[i]
      expect(num(stem, 'y1')).toBe(num(head, 'cy'))
      expect(Math.abs(num(stem, 'x1') - num(head, 'cx'))).toBeLessThanOrEqual(
        num(head, 'rx'),
      )
      expect(num(stem, 'x1')).toBe(num(stem, 'x2'))
      expect(num(stem, 'y2')).not.toBe(num(stem, 'y1'))
    })
  })

  it('turns the stem over at the middle line, and hangs it on the correct side (F15 drawing)', () => {
    const below = fixture([MIDDLE_LINE_STEP - 1, ''])
    render(<ScaleStaff notes={below} label="" degrees={degreesFor(below)} />)
    expect(num(stems()[0], 'y2')).toBeLessThan(num(stems()[0], 'y1'))
    expect(num(stems()[0], 'x1')).toBeGreaterThan(num(noteheads()[0], 'cx'))

    cleanup()

    const on = fixture([MIDDLE_LINE_STEP, ''])
    render(<ScaleStaff notes={on} label="" degrees={degreesFor(on)} />)
    expect(num(stems()[0], 'y2')).toBeGreaterThan(num(stems()[0], 'y1'))
    expect(num(stems()[0], 'x1')).toBeLessThan(num(noteheads()[0], 'cx'))
  })

  it('keeps the deepest stem clear of the degree row (F15 drawing, E2 R1d)', () => {
    const turning = fixture([MIDDLE_LINE_STEP, ''])
    render(<ScaleStaff notes={turning} label="" degrees={['5']} />)

    const stemFoot = num(stems()[0], 'y2')
    const numeralTop =
      num(degrees()[0], 'y') - Number(degrees()[0].getAttribute('font-size')) / 2

    expect(stemFoot).toBeLessThan(numeralTop)
  })

  it('closes the scale with a thin-and-thick final bar (F15 drawing)', () => {
    render(<ScaleStaff notes={ON_THE_FLOOR} label="" degrees={degreesFor(ON_THE_FLOOR)} />)

    const bar = screen.getByTestId('final-bar')
    const thin = bar.querySelector('line') as unknown as SVGLineElement
    const thick = bar.querySelector('rect') as unknown as SVGRectElement

    expect(thin).not.toBeNull()
    expect(thick).not.toBeNull()
    expect(num(thin, 'x1')).toBeLessThan(Number(thick.getAttribute('x')))
    expect(Number(thick.getAttribute('width'))).toBeGreaterThan(
      Number(thin.getAttribute('stroke-width')),
    )

    const lineYs = screen
      .getAllByTestId('staff-line')
      .map((line) => num(line as unknown as SVGLineElement, 'y1'))
    expect(num(thin, 'y1')).toBe(Math.min(...lineYs))
    expect(num(thin, 'y2')).toBe(Math.max(...lineYs))
    expect(Number(thick.getAttribute('y'))).toBe(Math.min(...lineYs))

    const last = noteheads()[noteheads().length - 1]
    expect(num(thin, 'x1')).toBeGreaterThan(num(last, 'cx') + num(last, 'rx'))
  })

  it('draws no final bar on an empty staff (F15 drawing)', () => {
    render(<ScaleStaff notes={[]} label="" degrees={degreesFor([])} />)

    expect(screen.queryByTestId('final-bar')).not.toBeInTheDocument()
  })

  it('draws one accidental per altered note and none for the rest (R2)', () => {
      render(
        <ScaleStaff
          notes={MIXED}
          label="E♭ G A♯ C♮"
          degrees={degreesFor(MIXED)}
        />,
      )

      expect(accidentals()).toHaveLength(3)
    })

    it('sets each accidental to the left of its notehead, level with it (R2)', () => {
      render(
        <ScaleStaff
          notes={MIXED}
          label="E♭ G A♯ C♮"
          degrees={degreesFor(MIXED)}
        />,
      )

      const notes = noteheads()
      const glyphs = accidentals()
      const owners = [notes[0], notes[2], notes[3]]

      glyphs.forEach((glyph, i) => {
        const [, right] = span(glyph)
        expect(right).toBeLessThan(num(owners[i], 'cx'))
        expect(num(glyph, 'y')).toBe(num(owners[i], 'cy'))
      })
    })

    it('renders ♯, ♭ and ♮ as those characters, not as a fallback box (R8)', () => {
      render(
        <ScaleStaff
          notes={MIXED}
          label="E♭ G A♯ C♮"
          degrees={degreesFor(MIXED)}
        />,
      )

      expect(accidentals().map((glyph) => glyph.textContent)).toEqual([
        '♭',
        '♯',
        '♮',
      ])
    })

    it('letters the accidentals in the jazz face (R8)', () => {
      render(
        <ScaleStaff
          notes={MIXED}
          label="E♭ G A♯ C♮"
          degrees={degreesFor(MIXED)}
        />,
      )

      accidentals().forEach((glyph) => {
        expect(glyph.getAttribute('class') ?? '').toMatch(/font-jazz/)
      })
    })

    it('gives a double accidental a slot two characters wide (R2)', () => {
      render(
        <ScaleStaff
          notes={fixture([3, '♯'], [10, '♯♯'])}
          label="F♯ F♯♯"
          degrees={['1', '2']}
        />,
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
      render(
        <ScaleStaff
          notes={C_BLUES}
          label="C E♭ F G♭ G B♭"
          degrees={degreesFor(C_BLUES)}
        />,
      )

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
      render(
        <ScaleStaff
          notes={C_BLUES}
          label="C E♭ F G♭ G B♭"
          degrees={degreesFor(C_BLUES)}
        />,
      )

      const xs = noteheads().map((note) => num(note, 'cx'))
      const shared = xs[4] - xs[3]
      const ordinary = xs[3] - xs[2]

      expect(shared).toBeGreaterThan(ordinary)
    })

    it('keeps the ♭ and the ♮ from overlapping each other (R4, AC2)', () => {
      render(
        <ScaleStaff
          notes={C_BLUES}
          label="C E♭ F G♭ G B♭"
          degrees={degreesFor(C_BLUES)}
        />,
      )

      const glyphs = accidentals()
      expect(glyphs.map((glyph) => glyph.textContent)).toEqual([
        '♭',
        '♭',
        '♮',
        '♭',
      ])

      expect(overlaps(span(glyphs[1]), span(glyphs[2]))).toBe(false)
    })

    it('keeps the ♮ clear of the notehead it follows (R4, AC2)', () => {
      render(
        <ScaleStaff
          notes={C_BLUES}
          label="C E♭ F G♭ G B♭"
          degrees={degreesFor(C_BLUES)}
        />,
      )

      const flat = noteheads()[3]
      const natural = accidentals()[2]
      const flatBox: [number, number] = [
        num(flat, 'cx') - num(flat, 'rx'),
        num(flat, 'cx') + num(flat, 'rx'),
      ]

      expect(overlaps(span(natural), flatBox)).toBe(false)
    })

    it('numbers six notes, the ♭5 and 5 each under its own head (R2, R1a, AC2, AC3)', () => {
      render(
        <ScaleStaff
          notes={C_BLUES}
          label="C E♭ F G♭ G B♭"
          degrees={C_BLUES_DEGREES}
        />,
      )

      const labels = degrees()
      expect(labels).toHaveLength(6)
      expect(labels.map((label) => label.textContent)).toEqual(C_BLUES_DEGREES)

      const xs = labels.map((label) => num(label, 'x'))
      expect(xs[4]).toBe(num(noteheads()[4], 'cx'))

      expect(xs[4] - xs[3]).toBeGreaterThan(xs[3] - xs[2])
    })
  })

  describe('ledger lines (B5)', () => {
    it('rules a ledger under a note above the staff (R5, AC4)', () => {
      render(<ScaleStaff notes={fixture([12, ''])} label="A" degrees={['1']} />)

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
      render(<ScaleStaff notes={fixture([0, ''])} label="C" degrees={['1']} />)

      const note = noteheads()[0]
      const ledgers = screen.getAllByTestId('ledger')

      expect(
        ledgers.filter((ledger) => num(ledger, 'y1') === num(note, 'cy')),
      ).toHaveLength(1)
    })

    it('rules every line between the staff and a far note (R5, AC4)', () => {
      render(<ScaleStaff notes={fixture([14, ''])} label="C" degrees={['1']} />)

      expect(screen.getAllByTestId('ledger')).toHaveLength(2)
    })

    it('rules none for a scale that stays inside the lines (R5, AC4)', () => {
      render(
        <ScaleStaff
          notes={INSIDE_THE_STAFF}
          label="E G B D F"
          degrees={degreesFor(INSIDE_THE_STAFF)}
        />,
      )

      expect(screen.queryAllByTestId('ledger')).toHaveLength(0)
    })
  })

  describe('what a screen reader gets (B6)', () => {
    it('reads as one image named by its notes, in order (R7, AC5)', () => {
      render(
        <ScaleStaff
          notes={E_DORIAN}
          label={E_DORIAN_LABEL}
          degrees={degreesFor(E_DORIAN)}
        />,
      )

      expect(
        screen.getByRole('img', { name: E_DORIAN_LABEL }),
      ).toBeInTheDocument()
    })

    it('announces nothing inside the drawing separately (R7, AC5)', () => {
      render(
        <ScaleStaff
          notes={E_DORIAN}
          label={E_DORIAN_LABEL}
          degrees={degreesFor(E_DORIAN)}
        />,
      )

      const staff = screen.getByRole('img', { name: E_DORIAN_LABEL })

      expect(screen.getAllByRole('img')).toHaveLength(1)
      expect(staff.querySelectorAll('[role], [aria-label]')).toHaveLength(0)
    })
  })

  describe('ink and fit (B7)', () => {
    it('takes every stroke and fill from currentColor (R9, AC8)', () => {
      const { container } = render(
        <ScaleStaff
          notes={C_BLUES}
          label="C E♭ F G♭ G B♭"
          degrees={degreesFor(C_BLUES)}
        />,
      )

      const drawn = Array.from(
        container.querySelectorAll('line, ellipse, path, text, rect'),
      )
      expect(drawn.length).toBeGreaterThan(0)

      drawn.forEach((element) => {
        const stroke = element.getAttribute('stroke')
        const fill = element.getAttribute('fill')

        const inks = [stroke, fill].filter((v) => v !== null && v !== 'none')
        expect(inks.length, `${element.tagName} sets no ink`).toBeGreaterThan(0)
        for (const ink of inks) expect(ink).toBe('currentColor')
      })
    })

    it('names no colour class anywhere in the drawing (R9, AC8)', () => {
      const { container } = render(
        <ScaleStaff
          notes={C_BLUES}
          label="C E♭ F G♭ G B♭"
          degrees={degreesFor(C_BLUES)}
        />,
      )

      Array.from(container.querySelectorAll('*')).forEach((element) => {
        expect(element.getAttribute('class') ?? '').not.toMatch(
          /(^|\s)(text-(?!\[)|bg-|fill-|stroke-|border-)/,
        )
      })
    })

    it('draws at its natural size and shrinks only to fit (R10, AC8)', () => {
      const { container } = render(
        <ScaleStaff
          notes={E_DORIAN}
          label={E_DORIAN_LABEL}
          degrees={degreesFor(E_DORIAN)}
        />,
      )

      const svg = container.querySelector('svg')
      expect(svg).not.toBeNull()

      const viewBox = svg!.getAttribute('viewBox')
      expect(viewBox).toMatch(/^0 0 \d+(\.\d+)? \d+/)
      const [, , vbWidth, vbHeight] = viewBox!.split(' ')
      expect(svg!.getAttribute('width')).toBe(vbWidth)
      expect(svg!.getAttribute('height')).toBe(vbHeight)

      expect(svg!.getAttribute('class') ?? '').toMatch(/\bmax-w-full\b/)
      expect(svg!.getAttribute('class') ?? '').toMatch(/\bh-auto\b/)
      expect(svg!.getAttribute('class') ?? '').not.toMatch(/(^|\s)w-full\b/)
    })

    it('keeps a staff space the same size whatever the note count (R10)', () => {
      const seven = render(
        <ScaleStaff
          notes={E_DORIAN}
          label={E_DORIAN_LABEL}
          degrees={degreesFor(E_DORIAN)}
        />,
      ).container.querySelector('svg')!
      const six = render(
        <ScaleStaff
          notes={C_BLUES}
          label="C E♭ F G♭ G B♭"
          degrees={degreesFor(C_BLUES)}
        />,
      ).container.querySelector('svg')!

      expect(six.getAttribute('height')).toBe(seven.getAttribute('height'))
      expect(Number(six.getAttribute('width'))).toBeLessThan(
        Number(seven.getAttribute('width')),
      )
    })

    it('keeps every note inside the viewBox at any width (R10)', () => {
      render(
        <ScaleStaff
          notes={C_BLUES}
          label="C E♭ F G♭ G B♭"
          degrees={degreesFor(C_BLUES)}
        />,
      )

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

    it('pencils the degrees in as a caption, not a second voice (R4, R5)', () => {
      render(
        <ScaleStaff
          notes={C_BLUES}
          label="C E♭ F G♭ G B♭"
          degrees={C_BLUES_DEGREES}
        />,
      )

      const captionSize = num(degrees()[0], 'font-size')
      const notationSize = num(accidentals()[0], 'font-size')
      expect(captionSize).toBeLessThan(notationSize)

      degrees().forEach((label) => {
        expect(label.getAttribute('fill')).toBe('currentColor')
        expect(label.getAttribute('class') ?? '').toMatch(/font-jazz/)
        expect(label.getAttribute('class') ?? '').not.toMatch(
          /(^|\s)(text-(?!\[)|bg-|fill-|stroke-|border-)/,
        )
        expect(label.getAttribute('font-weight')).toBeNull()
        expect(label.getAttribute('class') ?? '').not.toMatch(
          /font-(bold|semibold|medium)/,
        )
        expect(label.getAttribute('role')).toBeNull()
        expect(label.getAttribute('aria-label')).toBeNull()
      })

      expect(
        screen.getByTestId('degrees').getAttribute('role'),
      ).toBeNull()
      expect(
        screen.getByTestId('degrees').getAttribute('aria-label'),
      ).toBeNull()
    })
  })

  describe('the degree row (C1)', () => {
    const E_DORIAN_DEGREES = ['1', '2', '♭3', '4', '5', '6', '♭7']

    it('draws one number per note, at its own notehead (R1, R1a, R2, R3, AC1)', () => {
      render(
        <ScaleStaff
          notes={E_DORIAN}
          label={E_DORIAN_LABEL}
          degrees={E_DORIAN_DEGREES}
        />,
      )

      const labels = degrees()
      expect(labels).toHaveLength(7)
      expect(labels.map((label) => label.textContent)).toEqual(E_DORIAN_DEGREES)

      const xs = noteheads().map((note) => num(note, 'cx'))
      labels.forEach((label, i) => {
        expect(num(label, 'x')).toBe(xs[i])
      })
    })

    it('sits below the staff, never over a notehead (R1, R1b, R1d, AC11)', () => {
      const { container } = render(
        <ScaleStaff
          notes={ON_THE_FLOOR}
          label="C D E F G A B♭"
          degrees={E_DORIAN_DEGREES}
        />,
      )

      const lineYs = screen
        .getAllByTestId('staff-line')
        .map((line) => num(line, 'y1'))
      const bottomLine = Math.max(...lineYs)
      const space = Math.abs(lineYs[1] - lineYs[0])
      const height = Number(
        container.querySelector('svg')!.getAttribute('viewBox')!.split(' ')[3],
      )

      const lowestNote = Math.max(
        ...noteheads().map((note) => num(note, 'cy') + num(note, 'ry')),
      )

      degrees().forEach((label) => {
        const y = num(label, 'y')
        const half = num(label, 'font-size') / 2

        expect(y).toBeGreaterThan(bottomLine)

        expect(y - half).toBeGreaterThan(lowestNote)

        expect(height - (y + half)).toBeLessThan(space)
      })
    })

    it('keeps the same y, and the same height, on every day (R1c, R1e, AC10)', () => {
      const low = render(
        <ScaleStaff
          notes={ON_THE_FLOOR}
          label="C D E F G A B♭"
          degrees={E_DORIAN_DEGREES}
        />,
      ).container
      const high = render(
        <ScaleStaff
          notes={ABOVE_THE_FLOOR}
          label="G A B C D E F"
          degrees={E_DORIAN_DEGREES}
        />,
      ).container
      const empty = render(
        <ScaleStaff notes={[]} label="" degrees={[]} />,
      ).container

      const ysOf = (root: HTMLElement) =>
        Array.from(root.querySelectorAll('[data-testid="degree"]')).map(
          (label) => num(label, 'y'),
        )
      const heightOf = (root: HTMLElement) =>
        root.querySelector('svg')!.getAttribute('height')

      const lowYs = ysOf(low)
      const highYs = ysOf(high)
      expect(lowYs).toHaveLength(7)
      expect(highYs).toHaveLength(7)

      expect(new Set(lowYs).size).toBe(1)
      expect(new Set(highYs).size).toBe(1)
      expect(highYs[0]).toBe(lowYs[0])

      expect(heightOf(high)).toBe(heightOf(low))
      expect(heightOf(empty)).toBe(heightOf(low))
    })

    it('paints a number crossing a ledger line over it (R1d, AC11)', () => {
      const { container } = render(
        <ScaleStaff
          notes={ON_THE_FLOOR}
          label="C D E F G A B♭"
          degrees={E_DORIAN_DEGREES}
        />,
      )

      const ledgers = screen.getAllByTestId('ledger')
      const labels = degrees()
      expect(ledgers.length).toBeGreaterThan(0)
      expect(labels.length).toBeGreaterThan(0)

      ledgers.forEach((ledger) => {
        labels.forEach((label) => {
          expect(
            ledger.compareDocumentPosition(label) &
              Node.DOCUMENT_POSITION_FOLLOWING,
          ).toBeTruthy()
        })
      })

      const order = Array.from(container.querySelectorAll('*'))
      const lastLedger = Math.max(...ledgers.map((el) => order.indexOf(el)))
      const firstLabel = Math.min(...labels.map((el) => order.indexOf(el)))
      expect(lastLedger).toBeLessThan(firstLabel)
    })

    it('draws numbers for notes, not for labels (R8, AC6)', () => {
      render(<ScaleStaff notes={[]} label="" degrees={['1', '2']} />)

      expect(degrees()).toHaveLength(0)
      expect(screen.getAllByTestId('staff-line')).toHaveLength(5)
    })

    it('keeps two-character labels off each other at a phone width (R7, AC7)', () => {
      render(
        <ScaleStaff
          notes={E_DORIAN}
          label={E_DORIAN_LABEL}
          degrees={E_DORIAN_DEGREES}
        />,
      )

      const boxes = degrees().map(centredSpan)
      boxes.slice(1).forEach((box, i) => {
        expect(overlaps(boxes[i], box)).toBe(false)
      })
    })

    it('adds no width, so the panel cannot scroll sideways (R7, AC7)', () => {
      const numbered = render(
        <ScaleStaff
          notes={E_DORIAN}
          label={E_DORIAN_LABEL}
          degrees={E_DORIAN_DEGREES}
        />,
      ).container.querySelector('svg')!
      const bare = render(
        <ScaleStaff notes={E_DORIAN} label={E_DORIAN_LABEL} degrees={[]} />,
      ).container.querySelector('svg')!

      expect(numbered.getAttribute('width')).toBe(bare.getAttribute('width'))

      const className = numbered.getAttribute('class') ?? ''
      expect(className).toMatch(/\bmax-w-full\b/)
      expect(className).toMatch(/\bh-auto\b/)
      expect(className).not.toMatch(/(^|\s)w-full\b/)
    })

    it('derives nothing: the degrees arrive as a prop (R3, AC4)', () => {
      const source = readFileSync(
        resolve(
          process.cwd(),
          'src/features/daily-groove/components/solved/ScaleStaff.tsx',
        ),
        'utf8',
      )

      const specifiers = Array.from(
        source.matchAll(/(?:from|import|require)\s*\(?\s*'([^']+)'/g),
        (match) => match[1],
      )
      expect(specifiers).toEqual(['@/lib/theory/staff'])

      for (const forbidden of [
        'degrees',
        'notes',
        'changes',
        '../../types',
      ]) {
        expect(specifiers).not.toContain(forbidden)
      }

      expect(source).not.toMatch(/FLAVOUR_/)
      expect(source).not.toMatch(/\bAnswer\b/)
    })
  })
})
