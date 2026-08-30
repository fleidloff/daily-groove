import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { SolvedPanel } from './SolvedPanel'
import { GROOVES } from '../../data/grooves.generated'
import type { Answer } from '../../types'

const G_DORIAN: Answer = { root: 'G', flavour: 'Dorian' }

function renderPanel(overrides: Partial<Parameters<typeof SolvedPanel>[0]> = {}) {
  return render(
    <SolvedPanel
      answer={G_DORIAN}
      tries={1}
      streak={12}
      chord="Cm7"
      progression="Cm–Fm–G7"
      {...overrides}
    />,
  )
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

  it('shows the chord and the progression as chips under "The changes" (R4, AC4)', () => {
    renderPanel({ chord: 'Cm7', progression: 'Cm–Fm–G7' })
    const changes = screen.getByRole('group', { name: /the changes/i })
    expect(within(changes).getByText('Cm7')).toBeInTheDocument()
    expect(within(changes).getByText('Cm–Fm–G7')).toBeInTheDocument()
  })

  it('shows the seven scale notes under "Notes to live in" (R5, AC4)', () => {
    renderPanel()
    const notes = screen.getByRole('group', { name: /notes to live in/i })
    const chips = within(notes).getAllByRole('button')
    expect(chips.map((c) => c.textContent)).toEqual([
      'G',
      'A',
      'B♭',
      'C',
      'D',
      'E',
      'F',
    ])
  })

  it('draws its chips in the inverted tone, so they read on the panel (R4, R8)', () => {
    renderPanel()
    const changes = screen.getByRole('group', { name: /the changes/i })
    for (const chip of within(changes).getAllByRole('button')) {
      expect(chip.className).toMatch(/on-accent/)
    }
  })

  it('presents its chips as revealed values, not choices to make (R6)', () => {
    renderPanel()
    for (const chip of screen.getAllByRole('button')) {
      expect(chip).toBeDisabled()
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

  // --- Epic 3 — the two columns read as even rows --------------------------

  /** The element a labelled column lays its chips out on. */
  function chipRow(label: RegExp): HTMLElement {
    const column = screen.getByRole('group', { name: label })
    const first = within(column).getAllByRole('button')[0]
    return first.parentElement as HTMLElement
  }

  const CHANGES = /the changes/i
  const NOTES = /notes to live in/i

  // Step B1 — R6, AC7
  it('passes no width to its chips (R6, AC7)', () => {
    renderPanel()
    for (const chip of screen.getAllByRole('button')) {
      expect(chip.className).not.toContain('w-[60px]')
      expect(chip.className).not.toMatch(/\bw-\[/)
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

  // Step B2 — R5, AC5, AC6a. Seven chips in equal columns: four, then three
  // in columns the same width as the first row's (AC3a).
  it('lays the notes out on a grid of equal columns (R5, AC5, AC6a)', () => {
    renderPanel()
    const notes = chipRow(NOTES)

    expect(notes.className).toMatch(/\bgrid\b/)
    expect(notes.className).toContain('grid-cols-4')
    expect(notes.className).toContain('md:grid-cols-7')
    expect(notes.className).not.toContain('flex-wrap')
  })

  it('keeps every note chip read-only (R5, AC5)', () => {
    renderPanel()
    const notes = screen.getByRole('group', { name: NOTES })
    const chips = within(notes).getAllByRole('button')

    expect(chips).toHaveLength(7)
    for (const chip of chips) expect(chip).toBeDisabled()
  })

  // Step B3 — R3a, R5, AC6. Two chips in a gapped flex row already *are*
  // content-sized columns; equal columns would give a two-character chord half
  // the panel, with a gulf between it and the progression.
  it('sizes the changes columns to their content, not to equal halves (R3a, AC6)', () => {
    renderPanel({ chord: 'C7', progression: 'C7–Em7♭5–B♭maj7–Fmaj7' })
    const changes = chipRow(CHANGES)

    expect(changes.className).toContain('flex')
    expect(changes.className).not.toContain('grid-cols-2')
    expect(changes.className).not.toMatch(/\bgrid\b/)
    expect(changes.className).not.toContain('justify-between')
  })

  it('puts exactly the chord and the progression in the changes row (R5, AC6)', () => {
    renderPanel({ chord: 'C7', progression: 'C7–Em7♭5–B♭maj7–Fmaj7' })
    const changes = screen.getByRole('group', { name: CHANGES })
    const chips = within(changes).getAllByRole('button')

    expect(chips.map((chip) => chip.textContent)).toEqual([
      'C7',
      'C7–Em7♭5–B♭maj7–Fmaj7',
    ])
    for (const chip of chips) expect(chip).toBeDisabled()
  })

  // Step B4 — R8, AC9. A guard: it passes once B3 has landed, and stands so a
  // long progression can never widen the panel instead of moving down a line.
  it('wraps rather than overflowing on the longest progression (R8, AC9)', () => {
    const longest = GROOVES.map((groove) => groove.progression).sort(
      (a, b) => b.length - a.length,
    )[0]

    renderPanel({ chord: 'C7', progression: longest })
    const changes = chipRow(CHANGES)

    expect(within(screen.getByRole('group', { name: CHANGES })).getByText(longest))
      .toBeInTheDocument()
    expect(changes.className).toContain('flex-wrap')
    expect(changes.className).not.toMatch(/\bmin-w-/)
    expect(changes.className).not.toMatch(/overflow-x/)
  })
})
