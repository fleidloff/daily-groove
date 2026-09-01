import { readdirSync, readFileSync } from 'node:fs'
import { relative, resolve, sep } from 'node:path'
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { SolvedPanel } from './SolvedPanel'
import { barChords } from '../../lib/theory/changes'
import { GROOVES } from '../../data/grooves.generated'
import type { Answer, Attempt } from '../../types'

const G_DORIAN: Answer = { root: 'G', flavour: 'Dorian' }
const G_MIXOLYDIAN: Answer = { root: 'G', flavour: 'Mixolydian' }

/** One wrong guess, scored as the session scores one. */
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

const CHANGES = /the changes/i
const NOTES = /notes to live in/i

/** The lead sheet the changes column draws — the element that names the bars. */
function leadSheet(): HTMLElement {
  return within(screen.getByRole('group', { name: CHANGES })).getByRole('img')
}

/**
 * The chord symbol each bar of that sheet reads, in bar order.
 *
 * The symbol is the bar's first child, read on its own rather than off the
 * bar's whole `textContent`: since feature-15 Epic 3 a bar can also carry a
 * Roman numeral, and `'C7I'` is two values run together, not what a bar reads.
 * Every expectation this helper serves is unchanged — the numeral is read by
 * `numeralTexts` instead.
 */
function barTexts(): string[] {
  return Array.from(
    leadSheet().querySelectorAll<HTMLElement>('[data-bar]'),
    (bar) => bar.firstElementChild?.textContent ?? '',
  )
}

/** The Roman numeral each bar carries, in bar order — '' where a bar has none. */
function numeralTexts(): string[] {
  return Array.from(
    leadSheet().querySelectorAll<HTMLElement>('[data-numeral]'),
    (numeral) => numeral.textContent ?? '',
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

/** The degree numerals it draws under the noteheads, in note order. */
function degreeTexts(): string[] {
  return Array.from(
    staff().querySelectorAll<HTMLElement>('[data-testid="degree"]'),
    (degree) => degree.textContent ?? '',
  )
}

/**
 * The panel's header region: the `Row` holding the answer as a heading and, in
 * the muted text beside it, the one line saying what makes the mode itself.
 */
function header(): HTMLElement {
  return screen.getByRole('heading', { level: 2 }).parentElement as HTMLElement
}

/**
 * The panel's header block: the `Stack` holding the answer row and, beneath it,
 * the line saying how close the last wrong guess came. Scoped rather than read
 * off the whole `role="status"` region, because a bar symbol like `Em7♭5` can
 * satisfy a ♭-matching assertion by accident.
 */
function headerBlock(): HTMLElement {
  return header().parentElement as HTMLElement
}

/** Every paragraph the panel prints, in document order. */
function paragraphs(): HTMLElement[] {
  return Array.from(screen.getByRole('status').querySelectorAll<HTMLElement>('p'))
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

  // --- feature-15 Epic 1, Track D — the box reads as a lesson --------------

  it('says what makes the day\'s mode sound as it does (F15 E1 R1, R2, AC1)', () => {
    renderPanel({ answer: { root: 'C', flavour: 'Mixolydian' } })

    expect(
      screen.getByRole('heading', { name: 'C Mixolydian' }),
    ).toBeInTheDocument()
    // The line names the degree in the app's own notation, beside the answer.
    expect(within(header()).getByText(/♭7/)).toBeInTheDocument()
  })

  // The two cases this replaces — "reads one try, never 1 tries" and "counts
  // three tries and shows the new streak value" — asserted the sentence that
  // used to hold this slot. R5 deletes that sentence rather than moving it: the
  // dot row already reads `Solved` and `StreakBadge` already shows the run, so
  // a count restated in prose is the scorekeeping the box is being cleared of.
  it('carries neither the attempt count nor the streak (F15 E1 R5, R5a, R5b, AC2)', () => {
    renderPanel({ answer: { root: 'C', flavour: 'Mixolydian' } })

    const panel = screen.getByRole('status')
    expect(panel.textContent).not.toMatch(/tr(y|ies)/i)
    expect(panel.textContent).not.toMatch(/streak/i)
    // The other half of the case this replaces: a day genuinely solved makes no
    // claim of having been given up on.
    expect(screen.queryByText(/given up/i)).toBeNull()
  })

  it('gives a day given up on the same line (F15 E1 R7, R7a, AC3)', () => {
    renderPanel({ answer: { root: 'C', flavour: 'Mixolydian' }, revealed: true })

    // What makes a mode sound like itself does not depend on whether it was
    // found, so the line is unconditional. This pins it against a later branch.
    expect(within(header()).getByText(/♭7/)).toBeInTheDocument()
    // The phrase is the one remaining difference between the two boxes (R7a).
    expect(screen.getByText(/given up · the day is over/i)).toBeInTheDocument()
  })

  it('renders a mode the table has no line for, without the line (F15 E1 R3a, AC8)', () => {
    // Locrian is spellable — `FLAVOUR_INTERVALS` knows it, so the staff draws —
    // and has no character entry, because neither plain scale is an honest
    // baseline for a diminished fifth. That is the real shape of the risk: a
    // flavour unknown to both would throw in `scaleNotes` first, testing
    // nothing about this panel.
    renderPanel({ answer: { root: 'C', flavour: 'Locrian' } })

    expect(screen.getByRole('heading', { name: 'C Locrian' })).toBeInTheDocument()
    // Nothing beside the answer: no line, no empty muted paragraph either.
    expect(header().textContent).toBe('C Locrian')
    expect(within(header()).queryByRole('paragraph')).toBeNull()
    // And the rest of the box still pays the day off.
    expect(noteheads()).toHaveLength(7)
  })

  it('sets the answer in the display font at display size (R2)', () => {
    renderPanel()
    const heading = screen.getByRole('heading', { name: 'G Dorian' })
    // The panel's answer is a `lg` Heading. The hand-lettered face is reserved
    // for the page's masthead, so the answer keeps the serif it always had.
    expect(heading.className).toMatch(/font-display/)
    expect(heading.className).not.toMatch(/font-jazz/)
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
  it('shows the seven scale notes under "Notes to live in" (R1, R1a, AC1, AC6a, F15 E2 R6, AC5)', () => {
    renderPanel()
    const notes = screen.getByRole('group', { name: NOTES })

    expect(staff()).toHaveAccessibleName('1 G, 2 A, ♭3 B♭, 4 C, 5 D, 6 E, ♭7 F')
    expect(noteheads()).toHaveLength(7)
    // R1a — the letters are not printed beside the staff, beneath it, or under
    // the noteheads; they survive only as its accessible name.
    expect(staff().textContent).not.toMatch(/[A-G]/)
    expect(within(notes).queryAllByRole('button')).toHaveLength(0)
  })

  // --- feature-15 Epic 2, Track D — the box composes both props -----------

  // Step D1 — R1, R2, R9, AC1, AC2. The panel is the only place the answer and
  // the drawing meet, so it is the panel that turns the answer into degrees;
  // the staff derives nothing.
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

    // The solution is the same either way, so the row is too.
    expect(degreeTexts()).toEqual(['1', '2', '♭3', '4', '5', '6', '♭7'])
  })

  // Step D3 — R6a, AC9. The note names live in the accessible name and nowhere
  // else, and the row under the staff is numbers and accidentals only. This
  // fails the day someone adds a letter row beside the numbers.
  it('keeps the note names off the screen and the row to numbers (F15 E2 R6a, AC9)', () => {
    renderPanel()
    const notes = screen.getByRole('group', { name: NOTES })

    expect(notes.textContent).not.toMatch(/[A-G]/)
    for (const degree of degreeTexts()) expect(degree).toMatch(/^[♭♯]?\d$/)
  })

  // Step D4 — R9. Half the answer is in that row, so the drawing may not reach
  // the screen before the day has ended: exactly one source file draws it, and
  // it is the box that only renders when the day is over.
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

  // --- feature-15 Epic 3, Track D — the changes read as degrees ------------

  // Step D1 — R1, R2b, AC1, AC3, AC10. The numerals are counted from the day's
  // own root, so bar one is `I` on every day, and the `Em7♭5` bar reads a plain
  // `III` with its quality left on the symbol above it.
  it('writes a numeral under every bar of the day\'s changes (F15 E3 R1, R2b, AC1, AC3, AC10)', () => {
    renderPanel({
      answer: { root: 'C', flavour: 'Mixolydian' },
      progression: 'C7–Em7♭5–B♭maj7–Fmaj7',
      progressionDegrees: [0, 2, 6, 3],
    })

    expect(barTexts()).toEqual(['C7', 'Em7♭5', 'B♭maj7', 'Fmaj7'])
    expect(numeralTexts()).toEqual(['I', 'III', '♭VII', 'IV'])
    // Nothing reads as a degree of a parent major scale: this is C Mixolydian,
    // not the fifth mode of F, so no bar is a `V` of anything.
    expect(numeralTexts()[0]).toBe('I')
  })

  // Step D2 — R2, R2a, AC2. Bar four of a three-chord figure is a return, and
  // the symbol and the numeral in one bar always describe the same chord
  // because both go through `perBar`.
  it('returns a three-chord day to bar one in symbol and numeral alike (F15 E3 R2, R2a, AC2)', () => {
    renderPanel({
      answer: { root: 'E', flavour: 'Dorian' },
      progression: 'Em7–Bm7–C♯m7♭5',
      progressionDegrees: [0, 4, 5],
    })

    expect(barTexts()).toEqual(['Em7', 'Bm7', 'C♯m7♭5', 'Em7'])
    expect(numeralTexts()).toEqual(['I', 'V', 'VI', 'I'])
  })

  // Step D3 — R4a, R8, AC7. A numeral is less load-bearing than a bar, so a
  // groove with no degrees shows its changes and no numerals rather than
  // crashing the day's payoff. This is what pins the panel against a later
  // `progressionDegrees!` at the call site.
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

  // --- feature-15 Epic 4, Track C — the box carries the second line --------

  // Step C1 — R1, R3, R9, AC1. The line reads the last guess that missed and
  // names the degrees it got wrong in the app's own notation, so the sentence
  // and the staff's row read as one vocabulary.
  it('names how close the last wrong guess came (F15 E4 R1, R3, R9, AC1)', () => {
    renderPanel({ answer: G_MIXOLYDIAN, attempts: [miss('Dorian')] })

    const line = within(headerBlock()).getByText(
      /^You said Dorian — one note apart/,
    )
    // R9 — the lesson first, then how close the guess came.
    const character = within(header()).getByText(/♭7/)
    expect(
      character.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
  })

  // Step C2 — R6, AC5, AC6. Nothing to say means no paragraph, not an empty
  // one: an empty `Text` would leave a stray gap under the answer.
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

  // Step C3 — R11, AC11. `selectNearMiss` reads the attempts and nothing about
  // how the day ended, so the two boxes read the same sentence. This pins that
  // against a later `revealed` branch.
  it('reads the same line on a day given up on (F15 E4 R11, AC11)', () => {
    const attempts = [miss('Phrygian'), miss('Aeolian', false), miss('Dorian')]

    const solved = renderPanel({ answer: G_MIXOLYDIAN, attempts })
    const onSolved = within(headerBlock()).getByText(/^You said/).textContent
    solved.unmount()

    renderPanel({ answer: G_MIXOLYDIAN, attempts, revealed: true })
    const line = within(headerBlock()).getByText(/^You said/)

    expect(line.textContent).toBe(onSolved)
    // Giving up is Epic 1's phrase, in its own line; this one does not mention
    // it a second time.
    expect(line.textContent).not.toMatch(/given up/i)
  })

  // Step C4 — R9, AC9. Two lines, announced once.
  it('keeps both lines inside the one live region (F15 E4 R9, AC9)', () => {
    renderPanel({ answer: G_MIXOLYDIAN, attempts: [miss('Dorian')] })

    expect(screen.getAllByRole('status')).toHaveLength(1)
    const region = screen.getByRole('status')
    // Both lines are looked up in the header block — the staff's degree row
    // prints a `♭7` of its own — and then asserted to be inside the region, so
    // a line rendered outside it, or given a live region of its own, fails.
    expect(region).toContainElement(within(header()).getByText(/♭7/))
    expect(region).toContainElement(
      within(headerBlock()).getByText(/^You said Dorian/),
    )
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
    // What this forbids is a *count*, and it names the count rather than the
    // digits. Banning `/\b12\b/` outright looked equivalent and was not,
    // twice over: the staff's degree row prints `1 2 ♭3 …`, whose first two
    // concatenate to `12` in `textContent`, and the blues character line
    // contains `12-bar`, where the hyphen is a word boundary. Both would fail a
    // case that is about a streak. Asserting the wording instead cannot collide
    // with notation or prose that merely contains a number — and the four
    // assertions above already read the whole panel for every phrasing the box
    // ever used to claim one.
    expect(header().textContent).not.toMatch(/streak/i)
    expect(header().textContent).not.toMatch(/\d+\s*(day|try|tries|attempt)/i)
  })

  it('names the day as given up instead (R10, AC10)', () => {
    renderPanel({ revealed: true })
    expect(screen.getByText(/given up/i)).toBeInTheDocument()
  })

  it('draws the given-up line in the existing muted inverted tone, adding no token (R10)', () => {
    renderPanel({ revealed: true })
    expect(screen.getByText(/given up/i).className).toContain('on-accent/75')
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
        'src/features/daily-groove/components/solved/SolvedPanel.tsx',
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
