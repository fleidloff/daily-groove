import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Attribute, DailyResult, Groove } from '../types'

// Mock the audio wrapper and scoring so the composition can be driven
// deterministically without real playback. The store consumes scoreSelected.
vi.mock('../lib/audio', () => ({
  createAudioPlayer: vi.fn(),
}))
vi.mock('../lib/scoring', () => ({
  scoreSelected: vi.fn(),
}))

// Mock the persistence seam so useProgress reads/writes a controllable store —
// no real localStorage. useProgress defaults to this module-singleton store.
const { mockStore } = vi.hoisted(() => ({
  mockStore: {
    get: vi.fn(),
    getAll: vi.fn(),
    save: vi.fn(),
  },
}))
vi.mock('../lib/storage', () => ({
  createLocalStore: () => mockStore,
}))

import { createAudioPlayer } from '../lib/audio'
import { scoreSelected } from '../lib/scoring'
import { GroovePuzzle } from './GroovePuzzle'

const GROOVE: Groove = {
  id: 'groove-01',
  audioSrc: '/grooves/groove-01.mp3',
  scale: 'C minor',
  chord: 'Cm7',
  progression: 'Cm–Fm–G7',
}

function makePlayer(play: () => Promise<void>) {
  return { play: vi.fn(play), stop: vi.fn(), dispose: vi.fn() }
}

// Attribute → its picker's legend text, so tests can assert which pickers show.
const PROMPT: Record<Attribute, RegExp> = {
  scale: /which scale/i,
  chord: /which chord/i,
  progression: /which progression/i,
}

describe('GroovePuzzle', () => {
  beforeEach(() => {
    vi.mocked(createAudioPlayer).mockReset()
    vi.mocked(scoreSelected).mockReset()
    // Default persistence: empty store, save resolves.
    mockStore.get.mockReset().mockResolvedValue(null)
    mockStore.getAll.mockReset().mockResolvedValue([])
    mockStore.save.mockReset().mockResolvedValue(undefined)
    vi.mocked(createAudioPlayer).mockReturnValue(
      makePlayer(() => Promise.resolve()),
    )
    // Score by exact equality against the groove, over only the attempted keys.
    vi.mocked(scoreSelected).mockImplementation((groove, guesses) => {
      const out: Partial<Record<Attribute, boolean>> = {}
      for (const key of Object.keys(guesses) as Attribute[]) {
        out[key] = groove[key] === guesses[key]
      }
      return out
    })
  })

  it('renders a play control and the attribute selector', () => {
    render(<GroovePuzzle groove={GROOVE} />)
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
    for (const label of ['Scale', 'Chord', 'Progression']) {
      expect(
        screen.getByRole('checkbox', { name: label }),
      ).toBeInTheDocument()
    }
    // No picker until an attribute is selected.
    expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument()
  })

  it('shows only the selected attributes\' pickers (AC1, R3)', async () => {
    const user = userEvent.setup()
    render(<GroovePuzzle groove={GROOVE} />)

    await user.click(screen.getByRole('checkbox', { name: 'Scale' }))
    await user.click(screen.getByRole('checkbox', { name: 'Chord' }))

    expect(screen.getByText(PROMPT.scale)).toBeInTheDocument()
    expect(screen.getByText(PROMPT.chord)).toBeInTheDocument()
    // Progression was left unselected — no picker for it.
    expect(screen.queryByText(PROMPT.progression)).not.toBeInTheDocument()
  })

  it('scores the attempted parts and marks the rest skipped (AC2)', async () => {
    const user = userEvent.setup()
    render(<GroovePuzzle groove={GROOVE} />)

    await user.click(screen.getByRole('checkbox', { name: 'Scale' }))
    await user.click(screen.getByRole('checkbox', { name: 'Chord' }))
    await user.click(screen.getByRole('radio', { name: 'C minor' }))
    await user.click(screen.getByRole('radio', { name: 'Cm7' }))
    await user.click(screen.getByRole('button', { name: /submit/i }))

    const scaleRow = screen.getByRole('listitem', { name: 'Scale' })
    const chordRow = screen.getByRole('listitem', { name: 'Chord' })
    const progRow = screen.getByRole('listitem', { name: 'Progression' })

    expect(within(scaleRow).getByText(/correct/i)).toBeInTheDocument()
    expect(within(scaleRow).getByText('C minor')).toBeInTheDocument()
    expect(within(chordRow).getByText(/correct/i)).toBeInTheDocument()
    expect(within(chordRow).getByText('Cm7')).toBeInTheDocument()
    // Progression was never attempted.
    expect(within(progRow).getByText(/skipped/i)).toBeInTheDocument()
  })

  it('blocks submit with a prompt when nothing is selected (AC3, R2)', async () => {
    const user = userEvent.setup()
    render(<GroovePuzzle groove={GROOVE} />)

    const submit = screen.getByRole('button', { name: /submit/i })
    expect(submit).toBeDisabled()
    expect(
      screen.getByText(/select at least one attribute/i),
    ).toBeInTheDocument()

    // Clicking the disabled control does nothing — no breakdown appears.
    await user.click(submit)
    expect(screen.queryByRole('list')).not.toBeInTheDocument()
    expect(scoreSelected).not.toHaveBeenCalled()
  })

  it('scores each attempted attribute independently on a mixed submit (AC4, R4)', async () => {
    const user = userEvent.setup()
    render(<GroovePuzzle groove={GROOVE} />)

    await user.click(screen.getByRole('checkbox', { name: 'Scale' }))
    await user.click(screen.getByRole('checkbox', { name: 'Chord' }))
    await user.click(screen.getByRole('checkbox', { name: 'Progression' }))

    // scale correct, chord wrong, progression correct.
    await user.click(screen.getByRole('radio', { name: 'C minor' }))
    const wrongChord = screen
      .getAllByRole('radio')
      .find(
        (r) =>
          r.getAttribute('name') === 'chord' &&
          (r as HTMLInputElement).value !== 'Cm7',
      )!
    await user.click(wrongChord)
    await user.click(screen.getByRole('radio', { name: 'Cm–Fm–G7' }))
    await user.click(screen.getByRole('button', { name: /submit/i }))

    const scaleRow = screen.getByRole('listitem', { name: 'Scale' })
    const chordRow = screen.getByRole('listitem', { name: 'Chord' })
    const progRow = screen.getByRole('listitem', { name: 'Progression' })

    expect(within(scaleRow).getByText(/correct/i)).toBeInTheDocument()
    expect(within(chordRow).getByText(/incorrect/i)).toBeInTheDocument()
    expect(within(progRow).getByText(/correct/i)).toBeInTheDocument()
    // The correct chord answer is revealed even though the guess was wrong.
    expect(within(chordRow).getByText('Cm7')).toBeInTheDocument()
  })

  it('shows an error with retry when playback rejects, selector stays (R7)', async () => {
    vi.mocked(createAudioPlayer).mockReturnValue(
      makePlayer(() => Promise.reject(new Error('load failed'))),
    )
    const user = userEvent.setup()
    render(<GroovePuzzle groove={GROOVE} />)

    await user.click(screen.getByRole('button', { name: /play/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    // The rest of the UI stays usable: the attribute selector still renders.
    expect(screen.getByRole('checkbox', { name: 'Scale' })).toBeInTheDocument()
  })

  it("falls back to today's groove when no prop is given", () => {
    render(<GroovePuzzle />)
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: 'Scale' })).toBeInTheDocument()
  })

  it('persists the built result once on submit (R1, AC1)', async () => {
    const user = userEvent.setup()
    render(<GroovePuzzle groove={GROOVE} />)

    await user.click(screen.getByRole('checkbox', { name: 'Scale' }))
    await user.click(screen.getByRole('radio', { name: 'C minor' }))
    await user.click(screen.getByRole('button', { name: /submit/i }))

    await waitFor(() => expect(mockStore.save).toHaveBeenCalledTimes(1))
    const saved = mockStore.save.mock.calls[0][0] as DailyResult
    expect(saved.guesses).toEqual({ scale: 'C minor' })
    expect(saved.correctness).toEqual({ scale: true })
    expect(saved.date).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })

  it('shows the already-played view when today has a saved result (R2, AC2)', async () => {
    const stored: DailyResult = {
      date: '2026-08-21',
      guesses: { scale: 'C minor', chord: 'A7' },
      correctness: { scale: true, chord: false },
    }
    mockStore.get.mockResolvedValue(stored)
    mockStore.getAll.mockResolvedValue([stored])

    const user = userEvent.setup()
    render(<GroovePuzzle groove={GROOVE} />)

    // Once loaded, the already-played view replaces the guess controls.
    const alreadyPlayed = await screen.findByRole('region', {
      name: /already played/i,
    })
    // No pickers or selectors — the day cannot be re-guessed.
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryAllByRole('radio')).toHaveLength(0)
    expect(
      screen.queryByRole('button', { name: /submit/i }),
    ).not.toBeInTheDocument()

    // The true answer is revealed from the passed groove.
    expect(within(alreadyPlayed).getByText('Cm7')).toBeInTheDocument()

    // Replay still works.
    await user.click(within(alreadyPlayed).getByRole('button', { name: /replay/i }))
    expect(createAudioPlayer).toHaveBeenCalledWith(GROOVE.audioSrc)
  })
})
