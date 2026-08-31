import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { SolvedPanel } from './SolvedPanel'
import { barChords } from '../../lib/theory/changes'
import { GROOVES } from '../../data/grooves.generated'
import type { Answer } from '../../types'

const G_DORIAN: Answer = { root: 'G', flavour: 'Dorian' }

function renderPanel(overrides: Partial<Parameters<typeof SolvedPanel>[0]> = {}) {
  return render(
    <SolvedPanel
      answer={G_DORIAN}
      tries={1}
      streak={12}
      progression="Cm–Fm–G7"
      revealed={false}
      {...overrides}
    />,
  )
}

const CHANGES = /the changes/i
const NOTES = /notes to live in/i

/** The lead sheet the changes column draws — the element that names the bars. */
function leadSheet(): HTMLElement {
  return within(screen.getByRole('group', { name: CHANGES })).getByRole('img')
}

/** What each bar of that sheet reads, in bar order. */
function barTexts(): string[] {
  return Array.from(
    leadSheet().querySelectorAll<HTMLElement>('[data-bar]'),
    (bar) => bar.textContent ?? '',
  )
}

/** The staff the notes column draws — the element that names the scale. */
function staff(): HTMLElement {
  return within(screen.getByRole('group', { name: NOTES })).getByRole('img')
}

/** Its noteheads, left to right. */
function noteheads(): HTMLElement[] {
  return Array.from(staff().querySelectorAll<HTMLElement>('[data-testid="notehead"]'))
}

/** The accidental glyphs it draws, in order. */
function accidentalGlyphs(): string[] {
  return Array.from(
    staff().querySelectorAll<HTMLElement>('[data-testid="accidental"]'),
    (glyph) => glyph.textContent ?? '',
  )
}

/** An element's class list, read the one way that works for SVG too. */
function classOf(element: Element): string {
  return element.getAttribute('class') ?? ''
}

describe('SolvedPanel', () => {
  it('names the answer as root and flavour together (R1, R2, AC1)', () => {
    renderPanel()
    expect(screen.getByRole('heading', { name: 'G Dorian' })).toBeInTheDocument()
  })

  it('sets the answer in the display font at display size (R2)', () => {
    renderPanel()
    const heading = screen.getByRole('heading', { name: 'G Dorian' })
    // The panel's answer is a `lg` Heading. The hand-lettered face is reserved
    // for the page's masthead, so the answer keeps the serif it always had.
    expect(heading.className).toMatch(/font-display/)
    expect(heading.className).not.toMatch(/font-jazz/)
  })

  it('reads "one try", never "1 tries", after a first-guess solve (R3, AC2)', () => {
    renderPanel({ tries: 1 })
    expect(screen.getByText(/one try/i)).toBeInTheDocument()
    expect(screen.queryByText(/1 tries/i)).not.toBeInTheDocument()
  })

  it('counts three tries and shows the new streak value (R3, AC3)', () => {
    renderPanel({ tries: 3, streak: 12 })
    const meta = screen.getByText(/3 tries/i)
    expect(meta).toBeInTheDocument()
    expect(meta).toHaveTextContent(/12/)
    expect(screen.queryByText(/three tries/i)).not.toBeInTheDocument()
  })

  // Feature-11 Epic 1, Step C5 — R1, R2, R6, R7, AC1, AC2, AC4. The two chips
  // this used to assert are now one drawing: the same subject — what the
  // "The changes" column tells the player the harmony is — read off the bars
  // instead of off a pair of labels.
  it('draws the changes as four barred bars under "The changes" (R1, R2, AC1, AC2)', () => {
    renderPanel({ progression: 'Cm–Fm–G7' })

    expect(barTexts()).toEqual(['Cm', 'Fm', 'G7', 'Cm'])
    // A three-chord progression returns to bar one rather than running out.
    expect(
      screen.getByRole('group', { name: CHANGES }),
    ).toBeInTheDocument()
  })

  it('never prints the dash-joined progression as a value (R6, AC4)', () => {
    renderPanel({ progression: 'Cm–Fm–G7' })

    expect(screen.queryByText('Cm–Fm–G7')).toBeNull()
    expect(screen.getByRole('status').textContent).not.toContain('Cm–Fm–G7')
    // Nothing either column draws carries the en-dash form either.
    for (const column of screen.getAllByRole('group')) {
      expect(column.textContent).not.toContain('–')
    }
  })

  it('shows the tonic chord exactly once, as bar one (R6, AC4)', () => {
    renderPanel({ progression: 'C7–Em7♭5–B♭maj7–Fmaj7' })

    expect(barTexts()).toEqual(['C7', 'Em7♭5', 'B♭maj7', 'Fmaj7'])
    // The tonic used to be a chip of its own beside the progression; it is bar
    // one now, and bar one only.
    expect(screen.getByRole('status').textContent?.match(/C7/g)).toHaveLength(1)
  })

  // Feature-10 Epic 2, Step I2 — R6, AC9. `Chip` gained an optional
  // adornment; this was the guard that these read-only values did not gain a
  // *default* one. Feature-11 turned both columns into drawings, and the
  // subject survives the change: nothing the panel shows is marked as
  // sounding, and each drawing announces itself once.
  it('marks nothing the panel draws as sounding (F10 E2 R6, AC9)', () => {
    const { container } = renderPanel({ progression: 'Cm–Fm–G7' })

    expect(container.textContent).not.toContain('♪')
    for (const drawing of [leadSheet(), staff()]) {
      // Hidden decoration is allowed — the sheet's double bar is a rule — but
      // none of it prints a glyph in front of a value the way an adornment
      // does, and each drawing announces exactly what it draws.
      for (const hidden of drawing.querySelectorAll('[aria-hidden="true"]')) {
        expect(hidden.textContent).toBe('')
      }
      expect(drawing).toHaveAccessibleName()
    }
  })

  // Feature-11 Epic 2, Step C1 — R1, R1a, AC1, AC6a. The seven chips this used
  // to read off are one drawing now: the same subject — which notes the column
  // tells the player to live in — read off the staff instead.
  it('shows the seven scale notes under "Notes to live in" (R1, R1a, AC1, AC6a)', () => {
    renderPanel()
    const notes = screen.getByRole('group', { name: NOTES })

    expect(staff()).toHaveAccessibleName('G A B♭ C D E F')
    expect(noteheads()).toHaveLength(7)
    // R1a — the letters are not printed beside the staff, beneath it, or under
    // the noteheads; they survive only as its accessible name.
    expect(staff().textContent).not.toMatch(/[A-G]/)
    expect(within(notes).queryAllByRole('button')).toHaveLength(0)
  })

  // The chips named the inverted tone because they painted their own
  // background. The staff paints nothing, so the same subject — that the notes
  // read on the panel's inverted surface in both palettes — is now that it
  // fixes no ink of its own and inherits the panel's (F11 E2 R9, AC8).
  it('lets the staff read on the panel by inheriting its ink (R4, R8, F11 E2 AC8)', () => {
    renderPanel()
    const drawing = staff()

    for (const element of [drawing, ...drawing.querySelectorAll('*')]) {
      for (const attribute of ['fill', 'stroke']) {
        const value = element.getAttribute(attribute)
        // `none` turns a channel off — a whole note is an outline, not a
        // filled oval — and is not a colour being named.
        if (value !== null && value !== 'none') expect(value).toBe('currentColor')
      }
      expect(classOf(element)).not.toMatch(/text-(text|on-accent|accent|warm)/)
      expect(classOf(element)).not.toMatch(/#[0-9a-f]{3,8}/i)
    }
  })

  // Feature-11 Epic 1, Step C8 — R8, AC8. The chips name the inverted tone
  // because they paint their own background; the sheet paints nothing, so its
  // ink is the panel's and it must stay that way in both palettes.
  it('lets the sheet inherit the panel\'s ink rather than fixing one (R8, AC8)', () => {
    renderPanel()
    const sheet = leadSheet()

    for (const element of [sheet, ...sheet.querySelectorAll<HTMLElement>('*')]) {
      expect(element.className).not.toMatch(/text-(text|on-accent|accent|warm)/)
      expect(element.className).not.toMatch(/#[0-9a-f]{3,8}/i)
    }
  })

  // The chips carried this as `disabled`. Two drawings carry it by being
  // drawings: the panel offers nothing to press at all.
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

  // --- feature-7 Epic 3, Step C7: a revealed day (R10, R10a, AC10, AC10a) --

  it('shows the whole solution on a revealed day (R10a, AC10a)', () => {
    renderPanel({ revealed: true, progression: 'Cm–Fm–G7' })

    expect(screen.getByRole('heading', { name: 'G Dorian' })).toBeInTheDocument()

    // Step C7 — R11, AC7. A day given up on draws the same four bars.
    expect(barTexts()).toEqual(['Cm', 'Fm', 'G7', 'Cm'])

    // F11 E2, Step C3 — R11, AC7. A day given up on draws the same staff.
    expect(staff()).toHaveAccessibleName('G A B♭ C D E F')
    expect(noteheads()).toHaveLength(7)
  })

  it('claims neither a solve, nor an attempt count, nor a streak (R10, AC10)', () => {
    renderPanel({ revealed: true, tries: 4, streak: 12 })

    const panel = screen.getByRole('status')
    expect(panel.textContent).not.toMatch(/solved in/i)
    expect(panel.textContent).not.toMatch(/streak now/i)
    expect(panel.textContent).not.toMatch(/tries/i)
    expect(panel.textContent).not.toMatch(/one try/i)
    expect(panel.textContent).not.toMatch(/\b12\b/)
  })

  it('names the day as given up instead (R10, AC10)', () => {
    renderPanel({ revealed: true })
    expect(screen.getByText(/given up/i)).toBeInTheDocument()
  })

  it('draws the given-up line in the existing muted inverted tone, adding no token (R10)', () => {
    renderPanel({ revealed: true })
    expect(screen.getByText(/given up/i).className).toContain('on-accent/75')
  })

  it('brings the tries line back on a genuinely solved day (R10, AC10)', () => {
    renderPanel({ revealed: false, tries: 3, streak: 12 })

    const meta = screen.getByText(/3 tries/i)
    expect(meta).toHaveTextContent(/solved in/i)
    expect(meta).toHaveTextContent(/streak now 12/i)
    expect(screen.queryByText(/given up/i)).not.toBeInTheDocument()
  })

  // --- Epic 3 — the two columns read as even rows --------------------------

  // Step B1 — R6, AC7. The chips this measured are drawings now; the subject
  // is unchanged — no fixed pixel width is handed down into a column.
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
        'src/features/daily-groove/components/puzzle/SolvedPanel.tsx',
      ),
      'utf8',
    )

    expect(source).not.toMatch(/^\s*width\??:/m)
    expect(source).not.toContain('width="fixed"')
    expect(source).not.toContain('width="auto"')
  })

  // Step B2 laid seven chips out on a grid of equal columns so the notes read
  // as an even row. One drawing replaces them, and the same subject — the
  // notes spread evenly across the whole column rather than wrapping ragged —
  // is now that the staff takes the full width and no grid splits it
  // (F11 E2 R1c, R10, AC6).
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

  // F11 E1 R5, AC5 — supersedes feature-6's R3a for this column. That rule
  // sized "The changes" to its content because it was two chips of very
  // different lengths, and a two-character chord in an equal column would sit
  // in a gulf of space. Those chips are gone. Four bars of a lead sheet are
  // equal by convention, and the break has to be structural: 1 × 4, or 2 × 2 on
  // a phone, never 3 + 1.
  it('gives the four bars equal columns, breaking 2 × 2 or not at all (F11 E1 R5)', () => {
    renderPanel({ progression: 'C7–Em7♭5–B♭maj7–Fmaj7' })
    const changes = leadSheet()

    expect(changes.className).toMatch(/\bgrid-cols-2\b/)
    expect(changes.className).toMatch(/\bsm:grid-cols-4\b/)
    // Per-item wrapping is what produces 3 + 1, so it must not come back.
    expect(changes.className).not.toMatch(/\bflex-wrap\b/)
    expect(changes.className).not.toContain('justify-between')
  })

  it('puts exactly the four bars in the changes column (R5, AC6)', () => {
    renderPanel({ progression: 'C7–Em7♭5–B♭maj7–Fmaj7' })
    const changes = screen.getByRole('group', { name: CHANGES })

    expect(barTexts()).toEqual(['C7', 'Em7♭5', 'B♭maj7', 'Fmaj7'])
    // Nothing in the column is a control: the sheet is read, never pressed.
    expect(within(changes).queryAllByRole('button')).toHaveLength(0)
  })

  // Step B4 — R8, AC9. A guard: a long progression can never widen the panel or
  // scroll it. The mechanism is now the grid rather than a wrapping flex row —
  // the subject, that the panel does not overflow, is unchanged.
  // --- F11 Epic 2 Track C — the staff in the panel ------------------------

  // Step C2 — R1c, AC6
  it('stacks the lead sheet above the staff, both at full width (R1c, AC6)', () => {
    const { container } = renderPanel()
    const changes = screen.getByRole('group', { name: CHANGES })
    const notes = screen.getByRole('group', { name: NOTES })
    const panel = screen.getByRole('status')

    expect(panel).toContainElement(changes)
    expect(panel).toContainElement(notes)
    // The sheet comes first in document order, the staff under it.
    expect(
      changes.compareDocumentPosition(notes) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    // The two-column grid that held two rows of chips is gone: one stack, one
    // column, each group at the panel's full width.
    const stack = changes.parentElement as HTMLElement
    expect(notes.parentElement).toBe(stack)
    expect(classOf(stack)).toMatch(/flex-col/)
    expect(classOf(stack)).not.toContain('md:grid-cols-2')
    expect(container.querySelector('[class*="md:grid-cols-2"]')).toBeNull()
  })

  // Step C4 — R4, R6, AC2. The end-to-end guard for the one scale that breaks
  // a naive renderer: two of its six notes share a line.
  it('draws the blues day as six notes with ♭ and ♮ on one line (R4, R6, AC2)', () => {
    renderPanel({ answer: { root: 'C', flavour: 'Blues' } })

    expect(staff()).toHaveAccessibleName('C E♭ F G♭ G B♭')

    const heads = noteheads()
    expect(heads).toHaveLength(6)

    const [flat, natural] = heads.slice(3, 5)
    expect(natural.getAttribute('cy')).toBe(flat.getAttribute('cy'))
    expect(Number(natural.getAttribute('cx'))).toBeGreaterThan(
      Number(flat.getAttribute('cx')),
    )

    expect(accidentalGlyphs()).toEqual(['♭', '♭', '♮', '♭'])
  })

  it('breaks rather than overflowing on the longest progression (R8, AC9)', () => {
    const longest = GROOVES.map((groove) => groove.progression).sort(
      (a, b) => b.length - a.length,
    )[0]

    renderPanel({ progression: longest })
    const changes = leadSheet()

    expect(barTexts()).toEqual(barChords(longest))
    expect(changes.className).toMatch(/\bgrid-cols-2\b/)
    expect(changes.className).not.toMatch(/\bmin-w-/)
    expect(changes.className).not.toMatch(/overflow-x/)
  })
})
