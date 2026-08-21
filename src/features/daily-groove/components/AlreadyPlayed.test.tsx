import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AlreadyPlayed } from './AlreadyPlayed'
import type { DailyResult, Groove } from '../types'

const RESULT: DailyResult = {
  date: '2026-08-21',
  guesses: { scale: 'C minor', chord: 'A7' },
  correctness: { scale: true, chord: false },
}

const GROOVE: Groove = {
  id: 'groove-01',
  audioSrc: '/grooves/groove-01.mp3',
  scale: 'C minor',
  chord: 'Cm7',
  progression: 'Cm–Fm–G7',
}

describe('AlreadyPlayed', () => {
  it('renders the stored per-attribute breakdown', () => {
    render(
      <AlreadyPlayed
        result={RESULT}
        groove={GROOVE}
        onReplay={() => {}}
        isPlaying={false}
      />,
    )
    expect(screen.getByText(/scale/i)).toBeInTheDocument()
    expect(screen.getByText(/chord/i)).toBeInTheDocument()
    expect(screen.getByText('Correct')).toBeInTheDocument()
    expect(screen.getByText('Incorrect')).toBeInTheDocument()
  })

  it("reveals the groove's true answer per attempted attribute", () => {
    render(
      <AlreadyPlayed
        result={RESULT}
        groove={GROOVE}
        onReplay={() => {}}
        isPlaying={false}
      />,
    )
    const scaleRow = screen.getByRole('listitem', { name: 'Scale' })
    const chordRow = screen.getByRole('listitem', { name: 'Chord' })
    // The true answer is shown even where the guess was wrong.
    expect(within(scaleRow).getByText('C minor')).toBeInTheDocument()
    expect(within(chordRow).getByText('Cm7')).toBeInTheDocument()
    // The wrong guess ('A7') is not surfaced as the answer.
    expect(within(chordRow).queryByText('A7')).not.toBeInTheDocument()
  })

  it('falls back to the stored guess when no groove is provided', () => {
    render(<AlreadyPlayed result={RESULT} onReplay={() => {}} isPlaying={false} />)
    expect(screen.getByText(/C minor/)).toBeInTheDocument()
    expect(screen.getByText(/A7/)).toBeInTheDocument()
  })

  it('exposes a working replay control', async () => {
    const user = userEvent.setup()
    const onReplay = vi.fn()
    render(
      <AlreadyPlayed
        result={RESULT}
        groove={GROOVE}
        onReplay={onReplay}
        isPlaying={false}
      />,
    )
    await user.click(screen.getByRole('button'))
    expect(onReplay).toHaveBeenCalledTimes(1)
  })

  it('reflects the playing state on the replay control', () => {
    render(
      <AlreadyPlayed
        result={RESULT}
        groove={GROOVE}
        onReplay={() => {}}
        isPlaying={true}
      />,
    )
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('renders no guess inputs', () => {
    render(
      <AlreadyPlayed
        result={RESULT}
        groove={GROOVE}
        onReplay={() => {}}
        isPlaying={false}
      />,
    )
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryAllByRole('textbox')).toHaveLength(0)
  })
})
