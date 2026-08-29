import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { GrooveCard } from './GrooveCard'
import type { Groove } from '../types'

const GROOVE: Groove = {
  id: 'groove-01',
  audioSrc: '/grooves/groove-01.mp3',
  name: 'Sunroom Shuffle',
  bpm: 84,
  scale: 'G dorian',
  chord: 'Gm9',
  progression: 'Gm9–C13',
}

describe('GrooveCard', () => {
  it("shows the groove's name (D1, AC5)", () => {
    render(<GrooveCard groove={GROOVE} />)
    expect(
      screen.getByRole('heading', { name: 'Sunroom Shuffle' }),
    ).toBeInTheDocument()
  })

  it('shows the tempo as a figure labelled BPM (D1, AC5)', () => {
    render(<GrooveCard groove={GROOVE} />)
    expect(screen.getByText('84')).toBeInTheDocument()
    expect(screen.getByText('BPM')).toBeInTheDocument()
  })

  it('renders no meta line beneath the name (R9, AC5)', () => {
    const { container } = render(<GrooveCard groove={GROOVE} />)
    // The canvas' "No. 214 · 4 bars · loops forever" is dropped, not filled.
    expect(screen.queryByText(/No\.|bars|loops/)).not.toBeInTheDocument()
    expect(container.textContent ?? '').not.toMatch(/No\.|bars|loops/)
  })

  it('renders its children below the header region', () => {
    render(
      <GrooveCard groove={GROOVE}>
        <p>transport goes here</p>
      </GrooveCard>,
    )
    expect(screen.getByText('transport goes here')).toBeInTheDocument()
  })
})
