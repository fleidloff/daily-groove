import { useState } from 'react'
import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { GrooveCard } from './GrooveCard'
import { dateLine } from '../../lib/presentation/date'
import type { Groove } from '../../types'
import { GROOVES } from '../../data/grooves.generated'
import { selectGrooveForDate } from '../../lib/puzzle/selectGroove'
import { renderFeature } from '../../testing/renderFeature'

const DAY = new Date(2026, 7, 30)

const GROOVE: Groove = {
  id: 'groove-01',
  audioSrc: '/grooves/groove-01.mp3',
  name: 'Sunroom Shuffle',
  bpm: 84,
  root: 'G',
  flavour: 'Dorian',
  bars: 4,
  scale: 'G dorian',
  chord: 'Gm9',
  progression: 'Gm9–C13',
  headDelaySeconds: 0.025057,
}

describe('GrooveCard', () => {
  it("shows the groove's name (D1, AC5)", () => {
    render(<GrooveCard groove={GROOVE} date={DAY} />)
    expect(
      screen.getByRole('heading', { name: 'Sunroom Shuffle' }),
    ).toBeInTheDocument()
  })

  it('shows the tempo as a number and its unit (R1, R5, AC1, AC4)', () => {
    render(<GrooveCard groove={{ ...GROOVE, bpm: 105 }} date={DAY} />)
    expect(screen.getByText('105 bpm · Sunday, 30 August')).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'Sunroom Shuffle' }),
    ).toBeInTheDocument()
  })

  it('keeps the tempo out of the heading (R3, R4, AC3)', () => {
    render(<GrooveCard groove={{ ...GROOVE, bpm: 105 }} date={DAY} />)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading.textContent).toBe('Sunroom Shuffle')
    expect(heading).not.toHaveTextContent('105')
    expect(screen.getByText('105 bpm · Sunday, 30 August')).not.toBe(heading)
  })

  it('shows the tempo whether or not the groove is playing (R2, AC2)', async () => {
    function PlayingToggle() {
      const [playing, setPlaying] = useState(false)
      return (
        <button type="button" onClick={() => setPlaying(!playing)}>
          {playing ? 'Stop' : 'Play'}
        </button>
      )
    }

    const user = userEvent.setup()
    render(
      <GrooveCard groove={{ ...GROOVE, bpm: 105 }} date={DAY}>
        <PlayingToggle />
      </GrooveCard>,
    )

    expect(screen.getByText('105 bpm · Sunday, 30 August')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Play' }))
    expect(screen.getByText('105 bpm · Sunday, 30 August')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Stop' }))
    expect(screen.getByText('105 bpm · Sunday, 30 August')).toBeInTheDocument()
  })

  it('renders no meta line beneath the name (R9, AC5)', () => {
    const { container } = render(<GrooveCard groove={GROOVE} date={DAY} />)
    // The canvas' "No. 214 · 4 bars · loops forever" is dropped, not filled.
    expect(screen.queryByText(/No\.|bars|loops/)).not.toBeInTheDocument()
    expect(container.textContent ?? '').not.toMatch(/No\.|bars|loops/)
  })

  it('repeats the day beside the tempo, in one muted line', () => {
    render(<GrooveCard groove={{ ...GROOVE, bpm: 105 }} date={DAY} />)

    // One node, not two: the tempo and the day read as a single meta line
    // under the name, the way a lead sheet heads a chart.
    expect(
      screen.getByText('105 bpm · Sunday, 30 August'),
    ).toBeInTheDocument()
  })

  it('writes the day exactly as the page header writes it', () => {
    render(<GrooveCard groove={GROOVE} date={DAY} />)

    // Both call `dateLine`, so the two cannot drift into different spellings
    // of the same day. Asserting the shared output rather than a literal is
    // what makes that a guarantee rather than a coincidence.
    expect(
      screen.getByText(new RegExp(dateLine(DAY).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))),
    ).toBeInTheDocument()
  })

  it('renders its children below the header region', () => {
    render(
      <GrooveCard groove={GROOVE} date={DAY}>
        <p>transport goes here</p>
      </GrooveCard>,
    )
    expect(screen.getByText('transport goes here')).toBeInTheDocument()
  })
})

/**
 * Relocated from `src/app/page.test.tsx` (Epic 3, Step C2). These assert the
 * card as the page composes it, against the groove the day actually selects,
 * so they keep the composed render they were written against rather than a
 * hand-made prop.
 */
describe('through the composed page', () => {
  it("shows today's groove card", async () => {
    await renderFeature();

    const groove = selectGrooveForDate(new Date(), GROOVES);
    expect(
      screen.getByRole("heading", { name: groove.name }),
    ).toBeInTheDocument();
  })
})
