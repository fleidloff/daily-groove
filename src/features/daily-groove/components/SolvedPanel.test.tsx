import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import { SolvedPanel } from './SolvedPanel'
import type { Answer } from '../types'

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
    expect(heading.className).toMatch(/font-display/)
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
})
