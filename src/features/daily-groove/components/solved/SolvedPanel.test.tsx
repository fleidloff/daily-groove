import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { SolvedPanel } from './SolvedPanel'
import { coaching, solved } from '@/lib/snippets'
import { barChords } from '@/lib/theory/changes'
import { GROOVES } from '../../data/grooves.generated'
import type { Answer, Attempt } from '../../types'

const G_DORIAN: Answer = { root: 'G', flavour: 'Dorian' }
const G_MIXOLYDIAN: Answer = { root: 'G', flavour: 'Mixolydian' }

function miss(flavour: string, rootMatched = true): Attempt {
  return {
    root: rootMatched ? 'G' : 'B♭',
    flavour: flavour as Attempt['flavour'],
    correct: false,
    rootMatched,
    flavourMatched: false,
  }
}

function renderPanel(overrides: Partial<Parameters<typeof SolvedPanel>[0]> = {}) {
  return render(
    <SolvedPanel
      answer={G_DORIAN}
      progression="Cm–Fm–G7"
      attempts={[]}
      revealed={false}
      {...overrides}
    />,
  )
}

const CHANGES = solved.changes
const NOTES = solved.notesToLiveIn

function leadSheet(): HTMLElement {
  return within(screen.getByRole('group', { name: CHANGES })).getByRole('img')
}

function barTexts(): string[] {
  return Array.from(
    leadSheet().querySelectorAll<HTMLElement>('[data-bar]'),
    (bar) => bar.firstElementChild?.textContent ?? '',
  )
}

function numeralTexts(): string[] {
  return Array.from(
    leadSheet().querySelectorAll<HTMLElement>('[data-numeral]'),
    (numeral) => numeral.textContent ?? '',
  )
}

function staff(): HTMLElement {
  return within(screen.getByRole('group', { name: NOTES })).getByRole('img')
}

function noteheads(): HTMLElement[] {
  return Array.from(staff().querySelectorAll<HTMLElement>('[data-testid="notehead"]'))
}

function accidentalGlyphs(): string[] {
  return Array.from(
    staff().querySelectorAll<HTMLElement>('[data-testid="accidental"]'),
    (glyph) => glyph.textContent ?? '',
  )
}

function degreeTexts(): string[] {
  return Array.from(
    staff().querySelectorAll<HTMLElement>('[data-testid="degree"]'),
    (degree) => degree.textContent ?? '',
  )
}

function header(): HTMLElement {
  return screen.getByRole('heading', { level: 2 }).parentElement as HTMLElement
}

function headerBlock(): HTMLElement {
  return header().parentElement as HTMLElement
}

function paragraphs(): HTMLElement[] {
  return Array.from(screen.getByRole('status').querySelectorAll<HTMLElement>('p'))
}

function classOf(element: Element): string {
  return element.getAttribute('class') ?? ''
}

describe('SolvedPanel', () => {
  it('names the answer as root and flavour together (R1, R2, AC1)', () => {
    renderPanel()
    expect(screen.getByRole('heading', { name: 'G Dorian' })).toBeInTheDocument()
  })

  it('says what makes the day\'s mode sound as it does (F15 E1 R1, R2, AC1)', () => {
    renderPanel({ answer: { root: 'C', flavour: 'Mixolydian' } })

    expect(
      screen.getByRole('heading', { name: 'C Mixolydian' }),
    ).toBeInTheDocument()
    expect(within(header()).getByText(/♭7/)).toBeInTheDocument()
  })

  it('carries neither the attempt count nor the streak (F15 E1 R5, R5a, R5b, AC2)', () => {
    renderPanel({ answer: { root: 'C', flavour: 'Mixolydian' } })

    const panel = screen.getByRole('status')
    expect(panel.textContent).not.toMatch(/tr(y|ies)/i)
    expect(panel.textContent).not.toMatch(/streak/i)
    expect(screen.queryByText(solved.givenUp)).toBeNull()
  })

  it('gives a day given up on the same line (F15 E1 R7, R7a, AC3)', () => {
    renderPanel({ answer: { root: 'C', flavour: 'Mixolydian' }, revealed: true })

    expect(within(header()).getByText(/♭7/)).toBeInTheDocument()
    expect(screen.getByText(solved.givenUp)).toBeInTheDocument()
  })

  it('renders a mode the table has no line for, without the line (F15 E1 R3a, AC8)', () => {
    renderPanel({ answer: { root: 'C', flavour: 'Locrian' } })

    expect(screen.getByRole('heading', { name: 'C Locrian' })).toBeInTheDocument()
    expect(header().textContent).toBe('C Locrian')
    expect(within(header()).queryByRole('paragraph')).toBeNull()
    expect(noteheads()).toHaveLength(7)
  })

  it('sets the answer in the display font at display size (R2)', () => {
    renderPanel()
    const heading = screen.getByRole('heading', { name: 'G Dorian' })
    expect(heading.className).toMatch(/font-display/)
    expect(heading.className).not.toMatch(/font-jazz/)
  })

  it('draws the changes as four barred bars under "The changes" (R1, R2, AC1, AC2)', () => {
    renderPanel({ progression: 'Cm–Fm–G7' })

    expect(barTexts()).toEqual(['Cm', 'Fm', 'G7', 'Cm'])
    expect(
      screen.getByRole('group', { name: CHANGES }),
    ).toBeInTheDocument()
  })

  it('never prints the dash-joined progression as a value (R6, AC4)', () => {
    renderPanel({ progression: 'Cm–Fm–G7' })

    expect(screen.queryByText('Cm–Fm–G7')).toBeNull()
    expect(screen.getByRole('status').textContent).not.toContain('Cm–Fm–G7')
    for (const column of screen.getAllByRole('group')) {
      expect(column.textContent).not.toContain('–')
    }
  })

  it('shows the tonic chord exactly once, as bar one (R6, AC4)', () => {
    renderPanel({ progression: 'C7–Em7♭5–B♭maj7–Fmaj7' })

    expect(barTexts()).toEqual(['C7', 'Em7♭5', 'B♭maj7', 'Fmaj7'])
    expect(screen.getByRole('status').textContent?.match(/C7/g)).toHaveLength(1)
  })

  it('marks nothing the panel draws as sounding (F10 E2 R6, AC9)', () => {
    const { container } = renderPanel({ progression: 'Cm–Fm–G7' })

    expect(container.textContent).not.toContain('♪')
    for (const drawing of [leadSheet(), staff()]) {
      for (const hidden of drawing.querySelectorAll('[aria-hidden="true"]')) {
        expect(hidden.textContent).toBe('')
      }
      expect(drawing).toHaveAccessibleName()
    }
  })

  it('shows the seven scale notes under "Notes to live in" (R1, R1a, AC1, AC6a, F15 E2 R6, AC5)', () => {
    renderPanel()
    const notes = screen.getByRole('group', { name: NOTES })

    expect(staff()).toHaveAccessibleName('1 G, 2 A, ♭3 B♭, 4 C, 5 D, 6 E, ♭7 F')
    expect(noteheads()).toHaveLength(7)
    expect(staff().textContent).not.toMatch(/[A-G]/)
    expect(within(notes).queryAllByRole('button')).toHaveLength(0)
  })

  it('draws one degree under each note of the day\'s scale (F15 E2 R1, R2, AC1)', () => {
    renderPanel()

    expect(degreeTexts()).toEqual(['1', '2', '♭3', '4', '5', '6', '♭7'])
    expect(degreeTexts()).toHaveLength(noteheads().length)
  })

  it('numbers the blues scale six degrees, not seven (F15 E2 R2, AC2)', () => {
    renderPanel({ answer: { root: 'C', flavour: 'Blues' } })

    expect(degreeTexts()).toEqual(['1', '♭3', '4', '♭5', '5', '♭7'])
    expect(noteheads()).toHaveLength(6)
  })

  it('numbers a day given up on exactly as a solved one (F15 E2 R1, AC1)', () => {
    renderPanel({ revealed: true })

    expect(degreeTexts()).toEqual(['1', '2', '♭3', '4', '5', '6', '♭7'])
  })

  it('keeps the note names off the screen and the row to numbers (F15 E2 R6a, AC9)', () => {
    renderPanel()
    const notes = screen.getByRole('group', { name: NOTES })

    expect(notes.textContent).not.toMatch(/[A-G]/)
    for (const degree of degreeTexts()) expect(degree).toMatch(/^[♭♯]?\d$/)
  })

  it('draws the staff, and so the degrees, from the box alone (F15 E2 R9)', () => {
    const root = resolve(process.cwd(), 'src/features/daily-groove/components')
    const importers = readdirSync(root, { recursive: true, withFileTypes: true })
      .filter((entry) => entry.isFile() && /\.tsx?$/.test(entry.name))
      .filter((entry) => !/\.test\.tsx?$/.test(entry.name))
      .map((entry) => ({
        path: relative(root, resolve(entry.parentPath, entry.name)),
        source: readFileSync(resolve(entry.parentPath, entry.name), 'utf8'),
      }))
      .filter(({ source }) => /from '\.{1,2}(\/[\w-]+)*\/ScaleStaff'/.test(source))
      .map(({ path }) => path.split(sep).join('/'))

    expect(importers).toEqual(['solved/SolvedPanel.tsx'])
  })

  it('writes a numeral under every bar of the day\'s changes (F15 E3 R1, R2b, AC1, AC3, AC10)', () => {
    renderPanel({
      answer: { root: 'C', flavour: 'Mixolydian' },
      progression: 'C7–Em7♭5–B♭maj7–Fmaj7',
      progressionDegrees: [0, 2, 6, 3],
    })

    expect(barTexts()).toEqual(['C7', 'Em7♭5', 'B♭maj7', 'Fmaj7'])
    expect(numeralTexts()).toEqual(['I', 'III', '♭VII', 'IV'])
    expect(numeralTexts()[0]).toBe('I')
  })

  it('returns a three-chord day to bar one in symbol and numeral alike (F15 E3 R2, R2a, AC2)', () => {
    renderPanel({
      answer: { root: 'E', flavour: 'Dorian' },
      progression: 'Em7–Bm7–C♯m7♭5',
      progressionDegrees: [0, 4, 5],
    })

    expect(barTexts()).toEqual(['Em7', 'Bm7', 'C♯m7♭5', 'Em7'])
    expect(numeralTexts()).toEqual(['I', 'V', 'VI', 'I'])
  })

  it('draws the changes of a groove with no degrees at all (F15 E3 R4a, R8, AC7)', () => {
    renderPanel({ progression: 'Cm–Fm–G7' })

    expect(barTexts()).toEqual(['Cm', 'Fm', 'G7', 'Cm'])
    expect(numeralTexts()).toEqual([])
  })

  it('draws the changes of a groove whose degrees are empty (F15 E3 R4a, R8, AC7)', () => {
    renderPanel({ progression: 'Cm–Fm–G7', progressionDegrees: [] })

    expect(barTexts()).toEqual(['Cm', 'Fm', 'G7', 'Cm'])
    expect(numeralTexts()).toEqual([])
  })

  it('names how close the last wrong guess came on a day given up on (F15 E4 R1, R3, R9, AC1, F17 E3)', () => {
    renderPanel({
      answer: G_MIXOLYDIAN,
      attempts: [miss('Dorian')],
      revealed: true,
    })

    const line = within(headerBlock()).getByText(
      coaching.nearMissApart({
        flavour: 'Dorian',
        notes: 1,
        guessed: '♭3',
        answered: '3',
      }),
    )
    const character = within(header()).getByText(/♭7/)
    expect(
      character.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  it('says nothing about a miss on a day that was solved (F17 E3)', () => {
    renderPanel({ answer: G_MIXOLYDIAN, attempts: [miss('Dorian')] })

    expect(screen.queryByText(/you said/i)).toBeNull()
    for (const paragraph of paragraphs()) {
      expect(paragraph.textContent).not.toBe('')
    }
  })

  it('says nothing where the day was solved first time (F15 E4 R6, AC5, AC6)', () => {
    renderPanel({ answer: G_MIXOLYDIAN, attempts: [] })

    expect(screen.queryByText(/you said/i)).toBeNull()
    for (const paragraph of paragraphs()) {
      expect(paragraph.textContent).not.toBe('')
    }
  })

  it('says nothing where no guess missed (F15 E4 R6, AC5, AC6)', () => {
    renderPanel({
      answer: G_MIXOLYDIAN,
      attempts: [
        {
          root: 'G',
          flavour: 'Mixolydian',
          correct: true,
          rootMatched: true,
          flavourMatched: true,
        },
      ],
    })

    expect(screen.queryByText(/you said/i)).toBeNull()
    for (const paragraph of paragraphs()) {
      expect(paragraph.textContent).not.toBe('')
    }
  })

  it('never scolds the day given up on for having given up (F17 E3 R13, R14, AC13)', () => {
    const attempts = [miss('Phrygian'), miss('Aeolian', false), miss('Dorian')]

    renderPanel({ answer: G_MIXOLYDIAN, attempts, revealed: true })
    const line = within(headerBlock()).getByText(
      coaching.nearMissApart({
        flavour: 'Dorian',
        notes: 1,
        guessed: '♭3',
        answered: '3',
      }),
    )

    expect(line.textContent).toMatch(
      coaching.nearMissApart({
        flavour: 'Dorian',
        notes: 1,
        guessed: '♭3',
        answered: '3',
      }),
    )
    expect(line.textContent).not.toMatch(/given up/i)
  })

  it('keeps both lines inside the one live region (F15 E4 R9, AC9)', () => {
    renderPanel({
      answer: G_MIXOLYDIAN,
      attempts: [miss('Dorian')],
      revealed: true,
    })

    expect(screen.getAllByRole('status')).toHaveLength(1)
    const region = screen.getByRole('status')
    expect(region).toContainElement(within(header()).getByText(/♭7/))
    expect(region).toContainElement(
      within(headerBlock()).getByText(
        coaching.nearMissApart({
          flavour: 'Dorian',
          notes: 1,
          guessed: '♭3',
          answered: '3',
        }),
      ),
    )
  })

  it('lets the staff read on the panel by inheriting its ink (R4, R8, F11 E2 AC8)', () => {
    renderPanel()
    const drawing = staff()

    for (const element of [drawing, ...drawing.querySelectorAll('*')]) {
      for (const attribute of ['fill', 'stroke']) {
        const value = element.getAttribute(attribute)
        if (value !== null && value !== 'none') expect(value).toBe('currentColor')
      }
      expect(classOf(element)).not.toMatch(/text-(text|on-accent|accent|warm)/)
      expect(classOf(element)).not.toMatch(/#[0-9a-f]{3,8}/i)
    }
  })

  it('lets the sheet inherit the panel\'s ink rather than fixing one (R8, AC8)', () => {
    renderPanel()
    const sheet = leadSheet()

    for (const element of [sheet, ...sheet.querySelectorAll<HTMLElement>('*')]) {
      expect(element.className).not.toMatch(/text-(text|on-accent|accent|warm)/)
      expect(element.className).not.toMatch(/#[0-9a-f]{3,8}/i)
    }
  })

  it('presents the solution as revealed values, not choices to make (R6)', () => {
    renderPanel()
    expect(screen.queryAllByRole('button')).toHaveLength(0)
    for (const drawing of [leadSheet(), staff()]) {
      expect(within(drawing).queryAllByRole('button')).toHaveLength(0)
    }
  })

  it('announces itself as a result rather than an interruption (R9, AC9)', () => {
    renderPanel()
    const panel = screen.getByRole('status')
    expect(panel).toHaveTextContent('G Dorian')
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('carries exactly two columns — there is no tips column', () => {
    renderPanel()
    const columns = screen.getAllByRole('group')
    expect(columns).toHaveLength(2)
    expect(screen.queryByText(/try this/i)).not.toBeInTheDocument()
  })

  it('shows the whole solution on a revealed day (R10a, AC10a)', () => {
    renderPanel({ revealed: true, progression: 'Cm–Fm–G7' })

    expect(screen.getByRole('heading', { name: 'G Dorian' })).toBeInTheDocument()

    expect(barTexts()).toEqual(['Cm', 'Fm', 'G7', 'Cm'])

    expect(staff()).toHaveAccessibleName('1 G, 2 A, ♭3 B♭, 4 C, 5 D, 6 E, ♭7 F')
    expect(noteheads()).toHaveLength(7)
  })

  it('claims neither a solve, nor an attempt count, nor a streak (R10, AC10)', () => {
    renderPanel({ revealed: true })

    const panel = screen.getByRole('status')
    expect(panel.textContent).not.toMatch(/solved in/i)
    expect(panel.textContent).not.toMatch(/streak now/i)
    expect(panel.textContent).not.toMatch(/tries/i)
    expect(panel.textContent).not.toMatch(/one try/i)
    expect(header().textContent).not.toMatch(/streak/i)
    expect(header().textContent).not.toMatch(/\d+\s*(day|try|tries|attempt)/i)
  })

  it('names the day as given up instead (R10, AC10)', () => {
    renderPanel({ revealed: true })
    expect(screen.getByText(solved.givenUp)).toBeInTheDocument()
  })

  it('draws the given-up line in the existing muted inverted tone, adding no token (R10)', () => {
    renderPanel({ revealed: true })
    expect(screen.getByText(solved.givenUp).className).toContain('on-accent/75')
  })

  it('passes no fixed width to what its columns draw (R6, AC7)', () => {
    renderPanel()
    for (const drawing of [leadSheet(), staff()]) {
      for (const element of [drawing, ...drawing.querySelectorAll('*')]) {
        expect(classOf(element)).not.toContain('w-[60px]')
        expect(classOf(element)).not.toMatch(/\bw-\[/)
      }
    }
  })

  it('declares no width prop on its row (R6, AC7)', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/daily-groove/components/solved/SolvedPanel.tsx',
      ),
      'utf8',
    )

    expect(source).not.toMatch(/^\s*width\??:/m)
    expect(source).not.toContain('width="fixed"')
    expect(source).not.toContain('width="auto"')
  })

  it('gives the notes the column\'s full width, not a grid of cells (R1c, R10, AC6)', () => {
    renderPanel()
    const notes = screen.getByRole('group', { name: NOTES })

    expect(classOf(staff())).toContain('w-full')
    expect(staff().getAttribute('viewBox')).toBeTruthy()
    for (const element of [notes, ...notes.querySelectorAll('*')]) {
      expect(classOf(element)).not.toMatch(/grid-cols-/)
    }
  })

  it('keeps the notes column read-only (R5, AC5)', () => {
    renderPanel()
    const notes = screen.getByRole('group', { name: NOTES })

    expect(noteheads()).toHaveLength(7)
    expect(within(notes).queryAllByRole('button')).toHaveLength(0)
  })

  it('gives the four bars equal columns, in one row at every width (F17 E3 R1)', () => {
    renderPanel({ progression: 'C7–Em7♭5–B♭maj7–Fmaj7' })
    const changes = leadSheet()

    expect(changes.className).toMatch(/\bgrid-cols-4\b/)
    expect(changes.className).not.toMatch(/\bgrid-cols-2\b/)
    expect(changes.className).not.toMatch(/\bflex-wrap\b/)
    expect(changes.className).not.toContain('justify-between')
  })

  it('puts exactly the four bars in the changes column (R5, AC6)', () => {
    renderPanel({ progression: 'C7–Em7♭5–B♭maj7–Fmaj7' })
    const changes = screen.getByRole('group', { name: CHANGES })

    expect(barTexts()).toEqual(['C7', 'Em7♭5', 'B♭maj7', 'Fmaj7'])
    expect(within(changes).queryAllByRole('button')).toHaveLength(0)
  })

  it('stacks the lead sheet above the staff, both at full width (R1c, AC6)', () => {
    const { container } = renderPanel()
    const changes = screen.getByRole('group', { name: CHANGES })
    const notes = screen.getByRole('group', { name: NOTES })
    const panel = screen.getByRole('status')

    expect(panel).toContainElement(changes)
    expect(panel).toContainElement(notes)
    expect(
      changes.compareDocumentPosition(notes) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    const stack = changes.parentElement as HTMLElement
    expect(notes.parentElement).toBe(stack)
    expect(classOf(stack)).toMatch(/flex-col/)
    expect(classOf(stack)).not.toContain('md:grid-cols-2')
    expect(container.querySelector('[class*="md:grid-cols-2"]')).toBeNull()
  })

  it('draws the blues day as six notes with ♭ and ♮ on one line (R4, R6, AC2)', () => {
    renderPanel({ answer: { root: 'C', flavour: 'Blues' } })

    expect(staff()).toHaveAccessibleName('1 C, ♭3 E♭, 4 F, ♭5 G♭, 5 G, ♭7 B♭')

    const heads = noteheads()
    expect(heads).toHaveLength(6)

    const [flat, natural] = heads.slice(3, 5)
    expect(natural.getAttribute('cy')).toBe(flat.getAttribute('cy'))
    expect(Number(natural.getAttribute('cx'))).toBeGreaterThan(
      Number(flat.getAttribute('cx')),
    )

    expect(accidentalGlyphs()).toEqual(['♭', '♭', '♮', '♭'])
  })

  it('keeps one row rather than overflowing on the longest progression (F17 E3 R1)', () => {
    const longest = GROOVES.map((groove) => groove.progression).sort(
      (a, b) => b.length - a.length,
    )[0]

    renderPanel({ progression: longest })
    const changes = leadSheet()

    expect(barTexts()).toEqual(barChords(longest))
    expect(changes.className).toMatch(/\bgrid-cols-4\b/)
    expect(changes.className).not.toMatch(/\bmin-w-/)
    expect(changes.className).not.toMatch(/overflow-x/)
  })
})
