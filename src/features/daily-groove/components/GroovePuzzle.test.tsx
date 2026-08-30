import type { ReactElement } from 'react'
import { HEAD_DELAY_SECONDS } from '../lib/audio/transport'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Attempt, DailyResult, Groove, Root } from '../types'

// Audio is mocked so the composition can be driven without real playback.
// Scoring is NOT mocked: the flow below runs through the real store and the
// real `scoreAttempt`, which is the point of Step C8.
vi.mock('../lib/audio/audio', () => ({
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
vi.mock('../lib/persistence/storage', () => ({
  createLocalStore: () => mockStore,
}))

import { createAudioPlayer } from '../lib/audio/audio'
import { GroovePuzzle } from './GroovePuzzle'
import { flavourOptions, ROOTS } from '../lib/theory/music'
import { isoDate, selectGrooveForDate } from '../lib/puzzle/selectGroove'
import { GROOVES } from '../data/grooves.generated'
import { renderFeature } from '../testing/renderFeature'

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
 *
 * `stop()` mirrors the real player too: it halts *and* rewinds, so the position
 * the component reads through `useSyncExternalStore` returns to zero on its own.
 */
/**
 * The loop length of `GROOVE`, which is what the transport divides elapsed
 * seconds by. Kept in step with the fixture: 4 bars of 4/4 at 90bpm.
 */
const GROOVE_LOOP_SECONDS = (4 * 4 * 60) / 90

function makePlayer(
  play: () => Promise<void> = () => Promise.resolve(),
  loopSeconds: number = GROOVE_LOOP_SECONDS,
) {
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
    stop: vi.fn(() => {
      playing = false
      position = 0
      notify()
    }),
    getPosition: vi.fn(() => position),
    // The real element reports seconds into the *file*, so the fake adds the
    // encoder delay the transport subtracts back off. `seek(0.5)` therefore
    // still means "half way through the music", as it always did.
    getCurrentTime: vi.fn(() =>
      position === 0 ? 0 : HEAD_DELAY_SECONDS + position * loopSeconds,
    ),
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

  // "writes the day after every check, not only on a solve (E5 R2, AC1)" moved
  // to `hooks/usePuzzleSession.test.ts`: it asserts on the saved record alone,
  // and needs no region of the page rendered to hold.

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

  it("names the groove on each archive card, not just its answer", async () => {
    // Pinned by id rather than by date, so the expected name is the one the day
    // actually played and not whatever today's catalogue hashes to.
    const played = GROOVES[3]
    const yesterday: DailyResult = {
      date: YESTERDAY(),
      answer: { root: 'G', flavour: 'Dorian' },
      attempts: [miss('G', 'Dorian', true)],
      solved: true,
      grooveId: played.id,
    }
    mockStore.get.mockResolvedValue(null)
    mockStore.getAll.mockResolvedValue([yesterday])

    await renderPuzzle()

    const archive = screen
      .getByText(/grooves you.{0,3}ve played/i)
      .closest('section') as HTMLElement

    expect(within(archive).getByText(played.name)).toBeInTheDocument()
    // The answer is still there — the name is an addition, not a replacement.
    expect(within(archive).getByText('G Dorian')).toBeInTheDocument()
  })

  it('shows past days, and today once it is finished (E4 R1, R3, R8, AC5, AC7, AC10)', async () => {
    const yesterday: DailyResult = {
      date: YESTERDAY(),
      answer: { root: 'G', flavour: 'Dorian' },
      attempts: [miss('C', 'Lydian', false)],
      solved: false,
    }
    mockStore.get.mockResolvedValue(null)
    mockStore.getAll.mockResolvedValue([yesterday])

    const user = userEvent.setup()
    await renderPuzzle()

    const archiveEl = () =>
      screen.getByText(/grooves you.{0,3}ve played/i).closest('section') as HTMLElement

    // Before the day is finished the row holds yesterday alone.
    expect(within(archiveEl()).getByText('Yesterday')).toBeInTheDocument()
    // A past miss still shows its answer (E4 AC6d, AC11).
    expect(within(archiveEl()).getByText('G Dorian')).toBeInTheDocument()
    expect(within(archiveEl()).getByText('missed')).toBeInTheDocument()
    expect(within(archiveEl()).queryByText('Today')).not.toBeInTheDocument()

    // Solving today puts it in the row immediately — no reload (E4 R1, AC7).
    await guess(user, 'C', 'Minor')

    const archive = archiveEl()
    const labels = within(archive)
      .getAllByText(/^(Today|Yesterday)$/)
      .map((el) => el.textContent)
    // Today sorts ahead of every past day (E4 R3, AC5).
    expect(labels).toEqual(['Today', 'Yesterday'])
    // Solved on the first try, and its answer is on the card (E4 R6a).
    expect(within(archive).getByText('C Minor')).toBeInTheDocument()
    expect(within(archive).getByText('solved')).toBeInTheDocument()
    // The row carries no "All N" count: it shows one week and nothing more,
    // so there is no remainder for a count to stand in for (E4 R8).
    expect(archive.textContent).not.toMatch(/All\s*\d/)
  })

  it('shows today "In play" without its answer, and keeps the day playable (E4 R5, R6a, R6b, AC6a, AC6c, AC7)', async () => {
    // The fixture is adversarial on purpose: yesterday's answer shares neither
    // root nor flavour with today's, so a leak cannot be excused as another
    // card's legitimate text.
    const yesterday: DailyResult = {
      date: YESTERDAY(),
      answer: { root: 'G', flavour: 'Dorian' },
      attempts: [miss('D', 'Lydian', false)],
      solved: false,
    }
    expect(yesterday.answer.root).not.toBe(GROOVE.root)
    expect(yesterday.answer.flavour).not.toBe(GROOVE.flavour)

    mockStore.get.mockResolvedValue(null)
    mockStore.getAll.mockResolvedValue([yesterday])

    const user = userEvent.setup()
    await renderPuzzle()

    const wrong = wrongFlavour()
    const other = otherWrongFlavour()

    await guess(user, 'C', wrong)
    await guess(user, 'G', wrong)
    await guess(user, 'G', other)

    const archive = screen
      .getByText(/grooves you.{0,3}ve played/i)
      .closest('section') as HTMLElement

    // The day is in the row, marked as still winnable (E4 R6b, AC6c).
    expect(within(archive).getByText('Today')).toBeInTheDocument()
    expect(within(archive).getByText('In play')).toBeInTheDocument()
    // ...showing a placeholder where the answer will go (E4 R6a, AC6a).
    expect(within(archive).getByText('—')).toBeInTheDocument()

    // Adversarial sweep. The row prints answers — yesterday's is right there —
    // so the absence below is a masking rule, not an empty section.
    expect(within(archive).getByText('G Dorian')).toBeInTheDocument()
    expect(archive.textContent).not.toContain(GROOVE.root)
    expect(archive.textContent).not.toContain(GROOVE.flavour)
    expect(archive.textContent).not.toContain(
      `${GROOVE.root} ${GROOVE.flavour}`,
    )

    // Three spent attempts do NOT lock the day (E4 R5, AC7): changing a half
    // hands the control back...
    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    await user.click(within(rootGroup()).getByRole('button', { name: 'D' }))
    expect(control()).toBeEnabled()

    // ...and the fourth guess is accepted and recorded.
    await user.click(control())
    expect(mockStore.save).toHaveBeenCalledTimes(4)
    expect(mockStore.save.mock.calls[3][0].attempts).toHaveLength(4)
    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    // Still in play, still masked, after the fourth miss.
    expect(within(archive).getByText('In play')).toBeInTheDocument()
    expect(archive.textContent).not.toContain(GROOVE.flavour)
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
      screen.getByRole('button', { name: 'Stop the loop' }),
    ).toBeInTheDocument()
  })

  it('plays, stops and restarts on successive presses (E2 R6, AC5)', async () => {
    const player = makePlayer()
    vi.mocked(createAudioPlayer).mockReturnValue(player)

    const user = userEvent.setup()
    await renderPuzzle()

    // 1 — starts the loop and now offers to stop.
    await user.click(screen.getByRole('button', { name: 'Play the loop' }))
    expect(player.play).toHaveBeenCalledTimes(1)
    expect(
      await screen.findByRole('button', { name: 'Stop the loop' }),
    ).toBeInTheDocument()

    // 2 — partway through the loop...
    await act(async () => player.seek(0.5))
    expect(player.getPosition()).toBe(0.5)

    // ...a press halts playback and rewinds it (AC5). Nothing is held.
    await user.click(screen.getByRole('button', { name: 'Stop the loop' }))
    expect(player.stop).toHaveBeenCalledTimes(1)
    expect(player.isPlaying()).toBe(false)
    expect(player.getPosition()).toBe(0)
    expect(
      await screen.findByRole('button', { name: 'Play the loop' }),
    ).toBeInTheDocument()

    // 3 — the next press starts from the beginning, not from bar three. The
    // player is never re-created and nothing is disposed.
    await user.click(screen.getByRole('button', { name: 'Play the loop' }))
    expect(player.play).toHaveBeenCalledTimes(2)
    expect(player.getPosition()).toBe(0)
    expect(createAudioPlayer).toHaveBeenCalledTimes(1)
    expect(player.dispose).not.toHaveBeenCalled()
  })

  it('returns the progress track to the start on stop (E2 R6a, AC5a)', async () => {
    const player = makePlayer()
    vi.mocked(createAudioPlayer).mockReturnValue(player)

    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(screen.getByRole('button', { name: 'Play the loop' }))
    await act(async () => player.seek(0.5))

    // The track reads the sounding position...
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50',
    )
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '2',
    )

    await user.click(screen.getByRole('button', { name: 'Stop the loop' }))

    // ...and returns to the start, because the player rewound.
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    expect(screen.queryByTestId('progress-active')).not.toBeInTheDocument()
  })

  it('reads "■ Stop" while the groove sounds (E2 R4a, AC3a)', async () => {
    // The words are supplied by this feature, not by the design system, so the
    // sounding half of that pair is only asserted here. Without this, a
    // regression that dropped `text.stop` would leave the whole suite green.
    const player = makePlayer()
    vi.mocked(createAudioPlayer).mockReturnValue(player)

    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(screen.getByRole('button', { name: 'Play the loop' }))

    const control = await screen.findByRole('button', { name: 'Stop the loop' })
    expect(control).toHaveTextContent('■ Stop')
  })

  it('stacks the caption below the control rather than beside it (E2 R4, AC3)', async () => {
    await renderPuzzle()

    const play = screen.getByRole('button', { name: 'Play the loop' })
    // Full-width, with glyph and words (E2 R1, R4a, AC3a).
    expect(play).toHaveTextContent('▶ Play the groove')
    expect(play).toHaveClass('w-full')

    // The caption follows the control in document order, in a column — not as a
    // sibling within a row.
    const region = play.parentElement as HTMLElement
    expect(region).toHaveClass('flex-col')
    expect(region).not.toHaveClass('flex-row')
    expect(play.nextElementSibling).toHaveTextContent(/Play along/)
  })

  // Step D2's "creates today's player looped (R17, AC11)" moved to
  // `hooks/useTransport.test.ts`: it asserts on the audio adapter it was handed,
  // not on anything rendered.

  it("moves the bar highlight with the player's position (D5, AC8)", async () => {
    const player = makePlayer()
    vi.mocked(createAudioPlayer).mockReturnValue(player)

    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(screen.getByRole('button', { name: 'Play the loop' }))
    // The sounding bar is the highlighted segment on the track; the bar labels
    // that used to carry it were removed with the rest of the card's chrome.
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '0',
    )

    await act(async () => player.seek(0.6))
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '2',
    )
  })

  it('renders the groove card header and the transport, with no tempo (E1 R5, AC5)', async () => {
    await renderPuzzle()
    expect(
      screen.getByRole('heading', { name: GROOVE.name }),
    ).toBeInTheDocument()
    expect(screen.queryByText(String(GROOVE.bpm))).not.toBeInTheDocument()
    expect(screen.queryByText('BPM')).not.toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders the header with the streak beside the puzzle (E1 R1a, R2, R3, AC1a, AC2, AC3)', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 7, 29, 12, 0, 0))
      await renderPuzzle()

      expect(
        screen.getByRole('heading', { level: 1, name: 'Daily Groove' }),
      ).toBeInTheDocument()
      // The date is one line, and no longer a weekday element of its own.
      expect(screen.getByText('Saturday, 29 August')).toBeInTheDocument()
      expect(screen.queryByText('Saturday')).not.toBeInTheDocument()
      // The wordmark cluster went with it (E1 R1, AC1).
      expect(screen.queryByText('daily-groove')).not.toBeInTheDocument()
      expect(screen.getByLabelText(/current streak/i)).toHaveTextContent(
        /no streak yet/i,
      )
    } finally {
      vi.useRealTimers()
    }
  })

  it('reads "N days streak" once a day has been won (E1 R3, AC3)', async () => {
    const stored: DailyResult = {
      date: TODAY(),
      answer: { root: 'C', flavour: 'Minor' },
      attempts: [SOLVING],
      solved: true,
    }
    mockStore.get.mockResolvedValue(stored)
    mockStore.getAll.mockResolvedValue([stored])

    await renderPuzzle()

    expect(screen.getByLabelText(/current streak/i)).toHaveTextContent(
      '1 day streak',
    )
  })

  it('stacks its columns by default and only splits higher up (D8, R15, AC12)', async () => {
    const { container } = await renderPuzzle()

    const split = container.querySelector('.md\\:flex-row')
    expect(split, 'no collapsing two-column wrapper found').not.toBeNull()
    // Single column is the base case; the split is the breakpoint override.
    expect(split).toHaveClass('flex-col')
    expect(split).not.toHaveClass('flex-row')
  })

  it('gives each column the full width once stacked (R15)', async () => {
    const { container } = await renderPuzzle()

    const split = container.querySelector('.md\\:flex-row') as HTMLElement
    const columns = Array.from(split.children) as HTMLElement[]

    expect(columns).toHaveLength(2)
    for (const column of columns) {
      // The row aligns to `start`, which on the stacked (column) axis is the
      // horizontal one — so without `w-full` each card shrinks to its content
      // instead of spanning. Above `md` the flex basis governs and the width
      // returns to auto.
      expect(column).toHaveClass('w-full')
      expect(column).toHaveClass('md:w-auto')
    }
  })

  it("falls back to today's groove when no prop is given", async () => {
    await renderPuzzle(<GroovePuzzle />)
    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
    expect(rootGroup()).toBeInTheDocument()
  })

  // --- Epic 5: replay any groove you've played ------------------------------

  const archiveSection = () =>
    screen
      .getByText(/grooves you.{0,3}ve played/i)
      .closest('section') as HTMLElement

  /** The archive cards, most recent first. */
  const archiveCards = () => {
    const grid = archiveSection().querySelector('[class*="grid-cols"]')
    return grid ? (Array.from(grid.children) as HTMLElement[]) : []
  }

  /** One control per card, in the same order. */
  const archiveControls = () =>
    archiveCards().map((card) => within(card).getByRole('button'))

  const nameOf = (el: HTMLElement) => el.getAttribute('aria-label')

  /**
   * Every control on the page currently offering to stop. The single-sounding
   * invariant is asserted against this, not against one button at a time.
   */
  const soundingControls = () =>
    screen
      .getAllByRole('button')
      .filter((b) => /^Stop\b/.test(b.getAttribute('aria-label') ?? ''))

  const todayControl = () =>
    screen.getByRole('button', { name: /^(Play|Stop) the loop$/ })

  const grooveIn = (id: string) => GROOVES.find((g) => g.id === id)!

  /** A past day, N days back, played against a known groove. */
  function pastDay(daysAgo: number, grooveId: string | undefined): DailyResult {
    return {
      date: isoDate(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)),
      answer: { root: 'G', flavour: 'Dorian' },
      attempts: [miss('D', 'Lydian', false)],
      solved: false,
      ...(grooveId === undefined ? {} : { grooveId }),
    }
  }

  /**
   * A fresh player per source, kept by src so a swap can be observed from both
   * sides. The transport disposes the outgoing one, so the map holds the most
   * recent player built for each source.
   */
  function playersBySource() {
    const made = new Map<string, ReturnType<typeof makePlayer>>()
    vi.mocked(createAudioPlayer).mockImplementation((src: string) => {
      const player = makePlayer()
      made.set(src, player)
      return player
    })
    return made
  }

  it("plays today's groove through the page transport (E5 R3, R4, AC3)", async () => {
    const made = playersBySource()
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(todayControl())

    // The source handed to the transport is today's groove, looped (R12).
    expect(createAudioPlayer).toHaveBeenCalledWith(
      GROOVE.audioSrc,
      expect.objectContaining({ loop: true }),
    )
    expect(made.get(GROOVE.audioSrc)?.play).toHaveBeenCalledTimes(1)
    expect(nameOf(todayControl())).toBe('Stop the loop')

    // ...and pressing it again stops that same source rather than a second one.
    await user.click(todayControl())
    expect(made.get(GROOVE.audioSrc)?.stop).toHaveBeenCalledTimes(1)
    expect(createAudioPlayer).toHaveBeenCalledTimes(1)
    expect(soundingControls()).toEqual([])
  })

  it('gives every card in the row a play control naming its day (E5 R1, R6, AC1, AC6)', async () => {
    mockStore.getAll.mockResolvedValue([pastDay(1, 'groove-02'), pastDay(2, 'groove-03')])
    await renderPuzzle()

    const controls = archiveControls()
    expect(controls).toHaveLength(2)
    expect(nameOf(controls[0])).toBe("Play Yesterday's groove")
    expect(nameOf(controls[1])).toMatch(/^Play .+'s groove$/)
    expect(nameOf(controls[0])).not.toBe(nameOf(controls[1]))
    for (const c of controls) expect(c).toBeEnabled()
  })

  it("presses a card's control and hears that day's groove (E5 R2, AC1)", async () => {
    const made = playersBySource()
    mockStore.getAll.mockResolvedValue([pastDay(1, 'groove-02')])
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(archiveControls()[0])

    const yesterday = grooveIn('groove-02')
    expect(createAudioPlayer).toHaveBeenCalledWith(
      yesterday.audioSrc,
      expect.objectContaining({ loop: true }),
    )
    expect(made.get(yesterday.audioSrc)?.play).toHaveBeenCalledTimes(1)
    expect(nameOf(archiveControls()[0])).toBe("Stop Yesterday's groove")
  })

  it('never sounds two grooves at once, in either direction (E5 R3, R5, AC2, AC3, AC4, AC5)', async () => {
    const made = playersBySource()
    mockStore.getAll.mockResolvedValue([
      pastDay(1, 'groove-02'),
      pastDay(2, 'groove-03'),
    ])
    const user = userEvent.setup()
    await renderPuzzle()

    const first = grooveIn('groove-02')
    const second = grooveIn('groove-03')

    // 1 — today's loop is running, and it is the only thing sounding.
    await user.click(todayControl())
    expect(soundingControls().map(nameOf)).toEqual(['Stop the loop'])

    // 2 — a card's control takes over: today stops, the card sounds (AC2).
    await user.click(archiveControls()[0])
    expect(made.get(GROOVE.audioSrc)?.stop).toHaveBeenCalled()
    expect(made.get(first.audioSrc)?.play).toHaveBeenCalledTimes(1)
    expect(soundingControls().map(nameOf)).toEqual(["Stop Yesterday's groove"])
    expect(nameOf(todayControl())).toBe('Play the loop')

    // 3 — a second card takes over from the first (AC4).
    await user.click(archiveControls()[1])
    expect(made.get(first.audioSrc)?.stop).toHaveBeenCalled()
    expect(made.get(second.audioSrc)?.play).toHaveBeenCalledTimes(1)
    expect(soundingControls()).toHaveLength(1)
    expect(nameOf(soundingControls()[0])).toBe(nameOf(archiveControls()[1]))
    expect(nameOf(archiveControls()[0])).toBe("Play Yesterday's groove")

    // 4 — today's control takes it back off the card (AC3).
    await user.click(todayControl())
    expect(made.get(second.audioSrc)?.stop).toHaveBeenCalled()
    expect(soundingControls().map(nameOf)).toEqual(['Stop the loop'])
    for (const c of archiveControls()) expect(nameOf(c)).toMatch(/^Play /)
  })

  it("today's two controls agree, because both are bound to one source (E5 R5, R11, AC5a, AC13)", async () => {
    const made = playersBySource()
    const user = userEvent.setup()
    await renderPuzzle()

    // Finish the day so today joins the row, and the record it writes carries
    // the groove it played — which is what puts today's card on that source.
    await guess(user, 'C', 'Minor')
    expect(mockStore.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ grooveId: GROOVE.id }),
    )

    const todayCard = archiveCards()[0]
    expect(todayCard.textContent).toContain('Today')
    const cardControl = () => within(archiveCards()[0]).getByRole('button')
    expect(nameOf(cardControl())).toBe("Play Today's groove")

    // 1 — the full-width button starts it; BOTH controls show the sounding
    // affordance, and they are the only two on the page that do.
    await user.click(todayControl())
    expect(soundingControls().map(nameOf)).toEqual([
      'Stop the loop',
      "Stop Today's groove",
    ])

    // 2 — and the card's control stops the same source the button started.
    await user.click(cardControl())
    expect(soundingControls()).toEqual([])
    expect(nameOf(todayControl())).toBe('Play the loop')
    expect(nameOf(cardControl())).toBe("Play Today's groove")

    // One source, so one player: the card never built a second one.
    expect(createAudioPlayer).toHaveBeenCalledTimes(1)
    expect(made.get(GROOVE.audioSrc)?.play).toHaveBeenCalledTimes(1)
  })

  it('disables the control of a day whose groove has left the catalogue (E5 R10, AC12)', async () => {
    playersBySource()
    // An id that is not in the catalogue: it must not fall back to the date and
    // play some other groove under this day's answer.
    mockStore.getAll.mockResolvedValue([
      pastDay(1, 'groove-99'),
      pastDay(2, 'groove-03'),
    ])
    const user = userEvent.setup()
    await renderPuzzle()

    const gone = archiveControls()[0]
    expect(gone).toBeDisabled()
    expect(nameOf(gone)).toBe("Yesterday's groove is unavailable")

    await user.click(gone)
    expect(createAudioPlayer).not.toHaveBeenCalled()
    expect(soundingControls()).toEqual([])

    // The card itself still renders the day and its answer...
    expect(archiveCards()[0].textContent).toContain('Yesterday')
    expect(archiveCards()[0].textContent).toContain('G Dorian')
    // ...and its neighbour is unaffected.
    expect(archiveControls()[1]).toBeEnabled()
  })

  it('still replays a day saved before groove ids existed (E5 R8, AC8)', async () => {
    const made = playersBySource()
    // No grooveId at all: the day resolves by date, exactly as the page did.
    const legacy = pastDay(1, undefined)
    mockStore.getAll.mockResolvedValue([legacy])
    const user = userEvent.setup()
    await renderPuzzle()

    const control = archiveControls()[0]
    expect(control).toBeEnabled()
    await user.click(control)

    const expected = selectGrooveForDate(
      new Date(Date.now() - 24 * 60 * 60 * 1000),
      GROOVES,
    )
    expect(made.get(expected.audioSrc)?.play).toHaveBeenCalledTimes(1)
  })

  it('writes nothing to a record when a day is replayed (E5 R9, AC11)', async () => {
    playersBySource()
    mockStore.getAll.mockResolvedValue([
      pastDay(1, 'groove-02'),
      pastDay(2, 'groove-03'),
    ])
    const user = userEvent.setup()
    await renderPuzzle()

    const before = archiveCards().map((c) => c.textContent)

    await user.click(archiveControls()[0])
    await user.click(archiveControls()[1])
    await user.click(todayControl())
    await user.click(todayControl())

    // Replay is listening only: no record is written, and no card's day,
    // answer or mark moved.
    expect(mockStore.save).not.toHaveBeenCalled()
    expect(archiveCards().map((c) => c.textContent)).toEqual(before)
    expect(dotStates()).toEqual(['unspent', 'unspent', 'unspent'])
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
      expect(screen.getByText('Saturday, 29 August')).toBeInTheDocument()
      // ...and the card names the groove that same day selects.
      expect(
        screen.getByRole('heading', { name: expected.name }),
      ).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  /**
   * Relocated from `src/app/page.test.tsx` (Epic 3, Step I1). Three assertions
   * whose subject is the composed whole: what the page opens with, what it
   * withholds until the solve, and what it shows while the day's record is
   * still being read. They keep the composed render they were written
   * against — `renderFeature()` is the route's own render-and-settle, lifted
   * into the feature.
   */
  describe('through the composed page', () => {
    it("renders the designed shell with a play control and the guessing card", async () => {
      await renderFeature();

      // The play control leads the groove card: full width, glyph and words, with
      // an accessible name that states the action (E2 R1, R4a, AC3a, AC4).
      const play = screen.getByRole("button", { name: "Play the loop" });
      expect(play).toBeInTheDocument();
      expect(play).toHaveTextContent("\u25b6 Play the groove");
      expect(play).toHaveClass("w-full");

      // The player names a root and a flavour: twelve chips and four (AC1).
      const roots = screen.getByRole("radiogroup", { name: "Root" });
      const flavours = screen.getByRole("radiogroup", { name: "Flavour" });
      expect(within(roots).getAllByRole("button")).toHaveLength(12);
      expect(within(flavours).getAllByRole("button")).toHaveLength(4);

      // The retired subset-guessing model is gone from the route.
      expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    })

    it("reveals neither the solved panel nor the day's changes before the solve", async () => {
      const { container } = await renderFeature();

      const groove = selectGrooveForDate(new Date(), GROOVES);
      expect(container.textContent).not.toContain(groove.chord);
      expect(container.textContent).not.toContain(groove.progression);
    })

    it("waits for the day's saved record rather than flashing a fresh game", async () => {
      // Rendered but not settled: the store read has not resolved yet.
      render(<GroovePuzzle />);

      expect(screen.getByText(/loading/i)).toBeInTheDocument();
      expect(
        screen.queryByRole("radiogroup", { name: "Root" }),
      ).not.toBeInTheDocument();
      expect(document.querySelectorAll("[data-dot-state]")).toHaveLength(0);
    })
  })
})
