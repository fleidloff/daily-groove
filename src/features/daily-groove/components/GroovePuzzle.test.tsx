import type { ReactElement } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Attempt, DailyResult, Groove, Root } from '../types'

// Audio is mocked so the composition can be driven without real playback.
// Scoring is NOT mocked: the flow below runs through the real store and the
// real `scoreAttempt`, which is the point of Step C8.
vi.mock('../lib/audio', () => ({
  createAudioPlayer: vi.fn(),
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
import { GroovePuzzle } from './GroovePuzzle'
import { flavourOptions, ROOTS } from '../lib/music'
import { isoDate, selectGrooveForDate } from '../lib/selectGroove'
import { GROOVES } from '../lib/grooves.generated'

const GROOVE: Groove = {
  id: 'groove-01',
  audioSrc: '/grooves/groove-01.mp3',
  name: 'Test Groove',
  bpm: 90,
  root: 'C',
  flavour: 'Minor',
  bars: 4,
  scale: 'C minor',
  chord: 'Cm7',
  progression: 'Cm–Fm–G7',
}

/** The day's four flavour chips, resolved exactly as the component resolves them. */
const flavours = () => flavourOptions(new Date(), GROOVE)
/** A flavour that is on offer today but is not the answer. */
const wrongFlavour = () => flavours().find((f) => f !== 'Minor') as string
/** A second wrong flavour, so a third guess can differ from the second. */
const otherWrongFlavour = () =>
  flavours().filter((f) => f !== 'Minor' && f !== wrongFlavour())[0]

const TODAY = () => isoDate(new Date())
const YESTERDAY = () => isoDate(new Date(Date.now() - 24 * 60 * 60 * 1000))

function miss(root: Root, flavour: string, rootMatched: boolean): Attempt {
  return { root, flavour, correct: false, rootMatched, flavourMatched: false }
}

const SOLVING: Attempt = {
  root: 'C',
  flavour: 'Minor',
  correct: true,
  rootMatched: true,
  flavourMatched: true,
}

/**
 * A stand-in for the real AudioPlayer that keeps just enough state for the
 * component to observe: a playing flag, a position, and a listener set. It
 * deliberately mirrors the real player's optimistic ordering — `play()` flips
 * `isPlaying()` before the underlying promise settles and reverts on rejection.
 */
function makePlayer(play: () => Promise<void> = () => Promise.resolve()) {
  const listeners = new Set<() => void>()
  let playing = false
  let position = 0

  const notify = () => {
    for (const listener of Array.from(listeners)) listener()
  }

  return {
    play: vi.fn(async () => {
      playing = true
      notify()
      try {
        await play()
      } catch (error) {
        playing = false
        notify()
        throw error
      }
    }),
    pause: vi.fn(() => {
      playing = false
      notify()
    }),
    getPosition: vi.fn(() => position),
    isPlaying: vi.fn(() => playing),
    subscribe: vi.fn((fn: () => void) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    }),
    dispose: vi.fn(),
    // Test-only seam: move the loop position and notify, as the rAF poll would.
    seek: (next: number) => {
      position = next
      notify()
    },
  }
}

/**
 * Flush the store reads and the hydration effect they gate. The puzzle waits on
 * a promise-returning `ResultStore` before it paints a game, so every test that
 * wants the board has to let that settle first.
 */
async function settle() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

async function renderPuzzle(ui: ReactElement = <GroovePuzzle groove={GROOVE} />) {
  const result = render(ui)
  await settle()
  return result
}

const rootGroup = () => screen.getByRole('radiogroup', { name: 'Root' })
const flavourGroup = () => screen.getByRole('radiogroup', { name: 'Flavour' })
const control = () =>
  screen.getByRole('button', { name: /^(Pick a root|Check |Solved$)/ })
const dotStates = () =>
  Array.from(document.querySelectorAll('[data-dot-state]')).map((el) =>
    el.getAttribute('data-dot-state'),
  )
const nudge = () => screen.queryByRole('complementary', { name: 'A nudge' })

/** Click a root chip and a flavour chip, then press the check control. */
async function guess(
  user: ReturnType<typeof userEvent.setup>,
  root: string,
  flavour: string,
) {
  await user.click(within(rootGroup()).getByRole('button', { name: root }))
  await user.click(within(flavourGroup()).getByRole('button', { name: flavour }))
  await user.click(control())
}

describe('GroovePuzzle', () => {
  beforeEach(() => {
    vi.mocked(createAudioPlayer).mockReset()
    // Default persistence: empty store, save resolves.
    mockStore.get.mockReset().mockResolvedValue(null)
    mockStore.getAll.mockReset().mockResolvedValue([])
    mockStore.save.mockReset().mockResolvedValue(undefined)
    vi.mocked(createAudioPlayer).mockReturnValue(makePlayer())
  })

  it('renders a play control and the guessing card (R1, R2, AC1)', async () => {
    await renderPuzzle()

    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
    expect(within(rootGroup()).getAllByRole('button')).toHaveLength(12)
    expect(within(flavourGroup()).getAllByRole('button')).toHaveLength(4)
    // The retired subset-guessing model is gone.
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  it("offers the day's deterministic flavour options, including the answer (R3, R4)", async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 7, 29, 12, 0, 0))
      await renderPuzzle()

      const expected = flavourOptions(new Date(2026, 7, 29, 12, 0, 0), GROOVE)
      const rendered = within(flavourGroup())
        .getAllByRole('button')
        .map((b) => b.textContent)

      expect(rendered).toEqual(expected)
      expect(rendered).toContain('Minor')
    } finally {
      vi.useRealTimers()
    }
  })

  it('offers all twelve roots every day (R2)', async () => {
    await renderPuzzle()
    expect(
      within(rootGroup())
        .getAllByRole('button')
        .map((b) => b.textContent),
    ).toEqual(ROOTS)
  })

  it('drives the whole guess flow through the real store (R5, R7, R10, R11, R12)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    const wrong = wrongFlavour()

    // 1 — nothing chosen: the control prompts and is disabled (AC6).
    expect(control()).toHaveAccessibleName('Pick a root and a flavour')
    expect(control()).toBeDisabled()

    // 2 — a root alone is not enough (R7).
    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
    expect(control()).toHaveAccessibleName('Pick a root and a flavour')
    expect(control()).toBeDisabled()

    // 3 — both chosen: the control names the pair and goes live (R8, AC6).
    await user.click(within(flavourGroup()).getByRole('button', { name: wrong }))
    expect(control()).toHaveAccessibleName(`Check C ${wrong}`)
    expect(control()).toBeEnabled()

    // 4 — a wrong pair is reported, the chips stay, the control locks (AC7, AC9).
    await user.click(control())
    expect(screen.getByText(/right home note/i)).toBeInTheDocument()
    expect(
      within(rootGroup()).getByRole('button', { name: 'C' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(flavourGroup()).getByRole('button', { name: wrong }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(control()).toBeDisabled()

    // 5 — changing the flavour unblocks it again (AC9).
    await user.click(within(flavourGroup()).getByRole('button', { name: 'Minor' }))
    expect(control()).toHaveAccessibleName('Check C Minor')
    expect(control()).toBeEnabled()

    // 6 — the right pair solves the day (AC8).
    await user.click(control())
    expect(screen.getByText(/the groove is yours now/i)).toBeInTheDocument()
    expect(control()).toHaveAccessibleName('Solved')
    expect(control()).toBeDisabled()

    // 7 — a solved day stops accepting input (R12, AC10).
    await user.click(within(rootGroup()).getByRole('button', { name: 'G' }))
    expect(
      within(rootGroup()).getByRole('button', { name: 'C' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(rootGroup()).getByRole('button', { name: 'G' }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  it('replaces rather than accumulates a selection (R5, AC5)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
    await user.click(within(rootGroup()).getByRole('button', { name: 'G' }))

    const pressed = within(rootGroup())
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressed.map((b) => b.textContent)).toEqual(['G'])
  })

  // --- Epic 3: dots, feedback and the nudge --------------------------------

  it('opens with three unspent dots and the opening guidance (E3 R1, R4, AC1, AC4)', async () => {
    await renderPuzzle()

    expect(dotStates()).toEqual(['unspent', 'unspent', 'unspent'])
    expect(screen.getByText(/feels like rest/i)).toBeInTheDocument()
    expect(nudge()).not.toBeInTheDocument()
  })

  it('spends a dot and names the half that matched on each wrong guess (E3 R1, R3, AC2, AC5, AC7)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    // Right root, wrong flavour.
    await guess(user, 'C', wrong)
    expect(dotStates()).toEqual(['spent', 'unspent', 'unspent'])
    expect(screen.getByText(/right home note/i)).toBeInTheDocument()
    // One miss is not yet a nudge (AC8).
    expect(nudge()).not.toBeInTheDocument()

    // Neither half right.
    await guess(user, 'G', wrong)
    expect(dotStates()).toEqual(['spent', 'spent', 'unspent'])
    expect(screen.getByText(/not it\. no penalty/i)).toBeInTheDocument()
  })

  it("reveals the day's root in a nudge after the second miss (E3 R5, R6, AC8, AC9)", async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'C', wrong)
    expect(nudge()).not.toBeInTheDocument()

    await guess(user, 'G', wrong)
    const box = nudge() as HTMLElement
    expect(box).toBeInTheDocument()
    expect(box.textContent).toMatch(/root is C\./)
  })

  it('leaves the chips untouched when the nudge arrives (E3 R6, R7, AC10, AC11)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'C', wrong)
    await guess(user, 'G', wrong)
    expect(nudge()).toBeInTheDocument()

    const chips = within(rootGroup()).getAllByRole('button')
    // All twelve are still on offer — none filtered away, none locked.
    expect(chips).toHaveLength(12)
    for (const chip of chips) expect(chip).toBeEnabled()
    // The revealed root was NOT auto-selected: the only pressed chip is still
    // the player's own last choice.
    expect(
      chips
        .filter((b) => b.getAttribute('aria-pressed') === 'true')
        .map((b) => b.textContent),
    ).toEqual(['G'])
    expect(
      within(rootGroup()).getByRole('button', { name: 'C' }),
    ).toHaveAttribute('aria-pressed', 'false')
    // No chip is marked as already tried (AC11) — 'C' and 'G' have both been
    // guessed and neither carries any state beyond aria-pressed.
    expect(chips.filter((b) => b.getAttribute('aria-disabled') === 'true')).toEqual(
      [],
    )
  })

  it('never locks the player out, however many guesses miss (E3 R8, AC3, AC12)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()
    const other = otherWrongFlavour()

    await guess(user, 'C', wrong)
    await guess(user, 'G', wrong)
    await guess(user, 'G', other)

    // Three misses: the row is full and stays three wide (AC3).
    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    // The control is disabled only because the pair has not changed...
    expect(control()).toBeDisabled()
    // ...changing a half hands it straight back (AC12).
    await user.click(within(rootGroup()).getByRole('button', { name: 'D' }))
    expect(control()).toBeEnabled()

    // A fourth guess is spent and counted like any other; the row stays full.
    await user.click(control())
    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    expect(nudge()).toBeInTheDocument()
  })

  it('withdraws the nudge and turns the dots on the solve (E3 R9, AC13)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'C', wrong)
    await guess(user, 'G', wrong)
    expect(nudge()).toBeInTheDocument()

    await guess(user, 'C', 'Minor')

    expect(nudge()).not.toBeInTheDocument()
    expect(screen.getByText(/the groove is yours now/i)).toBeInTheDocument()
    expect(dotStates()).toEqual(['solved', 'solved', 'solved'])
  })

  // --- Epic 4: the solved panel --------------------------------------------

  it('never reveals the chord or the progression while unsolved (E4 R6, AC7)', async () => {
    const user = userEvent.setup()
    const { container } = await renderPuzzle()

    expect(container.textContent).not.toContain(GROOVE.chord)
    expect(container.textContent).not.toContain(GROOVE.progression)

    // Still hidden after guessing wrong — only a solve opens the panel.
    await guess(user, 'G', wrongFlavour())
    expect(container.textContent).not.toContain(GROOVE.chord)
    expect(container.textContent).not.toContain(GROOVE.progression)
    expect(
      screen.queryByRole('heading', { name: 'C Minor' }),
    ).not.toBeInTheDocument()
  })

  it('opens the solved panel with the answer, the tries and the changes (E4 R1-R5, AC1, AC3, AC4)', async () => {
    const user = userEvent.setup()
    const { container } = await renderPuzzle()

    await guess(user, 'C', wrongFlavour())
    await guess(user, 'C', 'Minor')

    expect(
      screen.getByRole('heading', { name: 'C Minor' }),
    ).toBeInTheDocument()
    // Two attempts were spent, and today's solve is the streak's first day.
    expect(screen.getByText(/solved in 2 tries/i)).toBeInTheDocument()
    expect(screen.getByText(/streak now 1/i)).toBeInTheDocument()
    expect(container.textContent).toContain(GROOVE.chord)
    expect(container.textContent).toContain(GROOVE.progression)
    // The scale notes come with it.
    expect(
      screen.getByRole('group', { name: /notes to live in/i }),
    ).toBeInTheDocument()
  })

  // --- Epic 5: persistence --------------------------------------------------

  it('waits rather than flashing a fresh game before the day is read (E5 R3, R4, C3a)', async () => {
    // A store that never resolves: the puzzle is stuck in its loading state.
    mockStore.get.mockReturnValue(new Promise<DailyResult | null>(() => {}))
    mockStore.getAll.mockReturnValue(new Promise<DailyResult[]>(() => {}))

    render(<GroovePuzzle groove={GROOVE} />)

    expect(screen.getByText(/loading/i)).toBeInTheDocument()
    // No fresh game paints first: neither an unspent dot row...
    expect(dotStates()).toEqual([])
    expect(screen.queryByRole('radiogroup', { name: 'Root' })).not.toBeInTheDocument()
    // ...nor the solved panel.
    expect(
      screen.queryByRole('heading', { name: 'C Minor' }),
    ).not.toBeInTheDocument()
  })

  it('writes the day after every check, not only on a solve (E5 R2, AC1)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'C', wrong)

    expect(mockStore.save).toHaveBeenCalledTimes(1)
    expect(mockStore.save).toHaveBeenLastCalledWith({
      date: TODAY(),
      answer: { root: 'C', flavour: 'Minor' },
      attempts: [miss('C', wrong, true)],
      solved: false,
    })

    await guess(user, 'C', 'Minor')

    expect(mockStore.save).toHaveBeenCalledTimes(2)
    expect(mockStore.save).toHaveBeenLastCalledWith({
      date: TODAY(),
      answer: { root: 'C', flavour: 'Minor' },
      attempts: [miss('C', wrong, true), SOLVING],
      solved: true,
    })
  })

  it('restores the attempts spent on a reload mid-game (E5 R3, AC1, AC2)', async () => {
    const wrong = wrongFlavour()
    const stored: DailyResult = {
      date: TODAY(),
      answer: { root: 'C', flavour: 'Minor' },
      attempts: [miss('C', wrong, true), miss('G', wrong, false)],
      solved: false,
    }
    mockStore.get.mockResolvedValue(stored)
    mockStore.getAll.mockResolvedValue([stored])

    const user = userEvent.setup()
    await renderPuzzle()

    // Two dots are still spent, and the feedback matches the second guess.
    expect(dotStates()).toEqual(['spent', 'spent', 'unspent'])
    expect(screen.getByText(/not it\. no penalty/i)).toBeInTheDocument()
    // The nudge earned by those two misses is back with them.
    expect(nudge()).toBeInTheDocument()

    // The next guess counts as the third attempt, not the first (AC2).
    await user.click(
      within(flavourGroup()).getByRole('button', { name: otherWrongFlavour() }),
    )
    await user.click(control())

    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    expect(mockStore.save).toHaveBeenCalledTimes(1)
    expect(mockStore.save.mock.calls[0][0].attempts).toHaveLength(3)
  })

  it('reopens a solved day with the panel and the chips locked (E5 R4, AC3)', async () => {
    const stored: DailyResult = {
      date: TODAY(),
      answer: { root: 'C', flavour: 'Minor' },
      attempts: [SOLVING],
      solved: true,
    }
    mockStore.get.mockResolvedValue(stored)
    mockStore.getAll.mockResolvedValue([stored])

    const user = userEvent.setup()
    await renderPuzzle()

    expect(screen.getByRole('heading', { name: 'C Minor' })).toBeInTheDocument()
    expect(screen.getByText(/solved in one try/i)).toBeInTheDocument()
    expect(control()).toHaveAccessibleName('Solved')
    expect(control()).toBeDisabled()

    // The chips do not accept input.
    await user.click(within(rootGroup()).getByRole('button', { name: 'G' }))
    expect(
      within(rootGroup()).getByRole('button', { name: 'G' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(
      within(rootGroup()).getByRole('button', { name: 'C' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('shows past days in the archive, and today only as the puzzle (E5 R8-R11, AC7, AC9)', async () => {
    const yesterday: DailyResult = {
      date: YESTERDAY(),
      answer: { root: 'G', flavour: 'Dorian' },
      attempts: [miss('C', 'Lydian', false)],
      solved: false,
    }
    const today: DailyResult = {
      date: TODAY(),
      answer: { root: 'C', flavour: 'Minor' },
      attempts: [SOLVING],
      solved: true,
    }
    mockStore.get.mockResolvedValue(today)
    mockStore.getAll.mockResolvedValue([yesterday, today])

    await renderPuzzle()

    const archive = screen
      .getByText(/grooves you.{0,3}ve played/i)
      .closest('section') as HTMLElement
    expect(within(archive).getByText('Yesterday')).toBeInTheDocument()
    // A missed day still shows its answer (AC9).
    expect(within(archive).getByText('G Dorian')).toBeInTheDocument()
    expect(within(archive).getByText('missed')).toBeInTheDocument()
    // Today is the puzzle above, not an archive card.
    expect(within(archive).queryByText('C Minor')).not.toBeInTheDocument()
    // The count is the full past-day tally, not the number of cards shown.
    expect(within(archive).getByText('All 1')).toBeInTheDocument()
  })

  it('shows the designed empty archive state on a first run (E5 R12, AC11)', async () => {
    await renderPuzzle()
    expect(screen.getByText(/no grooves behind you yet/i)).toBeInTheDocument()
  })

  it('starts the day fresh when storage holds nothing readable (E5 R5, AC4)', async () => {
    // A feature-1 blob reads back as "no results" through the v2 store.
    mockStore.get.mockResolvedValue(null)
    mockStore.getAll.mockResolvedValue([])

    await renderPuzzle()

    expect(dotStates()).toEqual(['unspent', 'unspent', 'unspent'])
    expect(control()).toHaveAccessibleName('Pick a root and a flavour')
    expect(screen.getByLabelText(/current streak/i)).toHaveTextContent(
      /no streak yet/i,
    )
    expect(screen.getByText(/no grooves behind you yet/i)).toBeInTheDocument()
  })

  it('keeps the guess in the session when the write fails (E5 R6, AC5)', async () => {
    mockStore.save.mockRejectedValue(new Error('quota exceeded'))
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'C', wrongFlavour())

    expect(dotStates()).toEqual(['spent', 'unspent', 'unspent'])
    expect(screen.getByText(/right home note/i)).toBeInTheDocument()
  })

  // --- Epic 1/2 regressions -------------------------------------------------

  it('shows an error with retry when playback rejects, the card stays (R7)', async () => {
    vi.mocked(createAudioPlayer).mockReturnValue(
      makePlayer(() => Promise.reject(new Error('load failed'))),
    )
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(screen.getByRole('button', { name: /play/i }))

    expect(await screen.findByRole('alert')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    // The rest of the UI stays usable: the guessing card still renders.
    expect(rootGroup()).toBeInTheDocument()
    // ...and so do the card's name and its transport panel (D6, AC9).
    expect(
      screen.getByRole('heading', { name: GROOVE.name }),
    ).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('clears the error and plays again on retry (D6, AC9)', async () => {
    let fail = true
    const player = makePlayer(() =>
      fail ? Promise.reject(new Error('load failed')) : Promise.resolve(),
    )
    vi.mocked(createAudioPlayer).mockReturnValue(player)

    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(screen.getByRole('button', { name: /play the loop/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    fail = false
    await user.click(screen.getByRole('button', { name: /retry/i }))

    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
    expect(
      screen.getByRole('button', { name: 'Pause the loop' }),
    ).toBeInTheDocument()
  })

  it('plays, pauses and resumes on successive presses (D5, R10, AC7)', async () => {
    const player = makePlayer()
    vi.mocked(createAudioPlayer).mockReturnValue(player)

    const user = userEvent.setup()
    await renderPuzzle()

    // 1 — starts the loop and now offers to pause.
    await user.click(screen.getByRole('button', { name: 'Play the loop' }))
    expect(player.play).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByRole('button', { name: 'Pause the loop' }),
    ).toBeInTheDocument()

    // 2 — pauses, holding position, and offers to play again.
    await user.click(screen.getByRole('button', { name: 'Pause the loop' }))
    expect(player.pause).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByRole('button', { name: 'Play the loop' }),
    ).toBeInTheDocument()

    // 3 — resumes. The player is never re-created and nothing is reset.
    await user.click(screen.getByRole('button', { name: 'Play the loop' }))
    expect(player.play).toHaveBeenCalledTimes(2)
    expect(createAudioPlayer).toHaveBeenCalledTimes(1)
    expect(player.dispose).not.toHaveBeenCalled()
  })

  // Step D2 — the groove repeats until the player stops it.
  it("creates today's player looped (R17, AC11)", async () => {
    const player = makePlayer()
    vi.mocked(createAudioPlayer).mockReturnValue(player)

    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(screen.getByRole('button', { name: 'Play the loop' }))

    expect(createAudioPlayer).toHaveBeenCalledWith(
      GROOVE.audioSrc,
      expect.objectContaining({ loop: true }),
    )
  })

  it("moves the bar highlight with the player's position (D5, AC8)", async () => {
    const player = makePlayer()
    vi.mocked(createAudioPlayer).mockReturnValue(player)

    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(screen.getByRole('button', { name: 'Play the loop' }))
    expect(screen.getByText('BAR 1')).toHaveAttribute('aria-current', 'true')

    await act(async () => player.seek(0.6))
    expect(screen.getByText('BAR 3')).toHaveAttribute('aria-current', 'true')
  })

  it('renders the groove card header and the transport (D1, D2)', async () => {
    await renderPuzzle()
    expect(
      screen.getByRole('heading', { name: GROOVE.name }),
    ).toBeInTheDocument()
    expect(screen.getByText(String(GROOVE.bpm))).toBeInTheDocument()
    expect(screen.getByText('BPM')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders the header with the streak beside the puzzle (D3, D4)', async () => {
    await renderPuzzle()
    expect(
      screen.getByRole('heading', { level: 1, name: "Today's groove" }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText(/current streak/i)).toBeInTheDocument()
  })

  it('stacks its columns by default and only splits higher up (D8, R15, AC12)', async () => {
    const { container } = await renderPuzzle()

    const split = container.querySelector('.md\\:flex-row')
    expect(split, 'no collapsing two-column wrapper found').not.toBeNull()
    // Single column is the base case; the split is the breakpoint override.
    expect(split).toHaveClass('flex-col')
    expect(split).not.toHaveClass('flex-row')
  })

  it("falls back to today's groove when no prop is given", async () => {
    await renderPuzzle(<GroovePuzzle />)
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
    expect(rootGroup()).toBeInTheDocument()
  })

  it('shows the same day in the header that it used to pick the groove (R5, AC3)', async () => {
    // AC3's second clause: the date on screen and the day driving selection must
    // be one and the same. Resolving "today" twice would pass every other test
    // here and still disagree across a midnight boundary.
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 7, 29, 12, 0, 0))
      const today = new Date(2026, 7, 29, 12, 0, 0)
      const expected = selectGrooveForDate(today, GROOVES)

      await renderPuzzle(<GroovePuzzle />)

      // The header renders the day...
      expect(screen.getByText('29 August')).toBeInTheDocument()
      // ...and the card names the groove that same day selects.
      expect(
        screen.getByRole('heading', { name: expected.name }),
      ).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })
})
