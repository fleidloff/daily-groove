import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Attempt, DailyResult, Groove, Root } from '../types'

// The audio module is NOT mocked, and neither is scoring: the flows below run
// through the real Web Audio player, the real store and the real
// `scoreAttempt`. Playback is driven by stubbing the browser instead — see
// `installFakeAudioContext` below.

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

import { GroovePuzzle } from './GroovePuzzle'
import { flavourOptions, ROOTS } from '../lib/theory/music'
import { isoDate, selectGrooveForDate } from '../lib/puzzle/selectGroove'
import { GROOVES } from '../data/grooves.generated'
import { renderFeature } from '../testing/renderFeature'
import {
  installFakeAudioContext,
  type FakeContext,
} from '../testing/fakeAudioContext'

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
  headDelaySeconds: 0.025057,
}

/** The day's four flavour chips, resolved exactly as the component resolves them. */
const flavours = () => flavourOptions(new Date(), GROOVE)
/** A flavour that is on offer today but is not the answer. */
const wrongFlavour = () => flavours().find((f) => f !== 'Minor') as string
/** A second wrong flavour, so a third guess can differ from the second. */
const otherWrongFlavour = () =>
  flavours().filter((f) => f !== 'Minor' && f !== wrongFlavour())[0]

const TODAY = () => isoDate(new Date())

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
 * The loop length of `GROOVE`, which is what the transport divides elapsed
 * seconds by. Kept in step with the fixture: 4 bars of 4/4 at 90bpm.
 */
const GROOVE_LOOP_SECONDS = (4 * 4 * 60) / 90

/**
 * The page is driven through the *real* player against a fake `AudioContext`,
 * rather than through a stand-in for the player.
 *
 * Position is now arithmetic over an audio clock, and a hand-made player that
 * reported its own position would only prove the page can read a number back
 * out of one. The fake context gives the tests the clock itself, so "three
 * eighths of the way through the loop" is an exact number of seconds and the
 * assertion runs over the same code path the browser runs.
 */
let fake: FakeContext
let frame: () => void

/**
 * A hand-driven `requestAnimationFrame`, so the player's position poll fires
 * only when a test says so — and never outside `act`.
 */
function installFrames() {
  const pending = new Map<number, FrameRequestCallback>()
  let nextId = 1

  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    const id = nextId
    nextId += 1
    pending.set(id, fn)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    pending.delete(id)
  })

  return function runFrame() {
    const due = Array.from(pending.entries())
    pending.clear()
    for (const [, fn] of due) fn(0)
  }
}

/** Seconds into a loop of `GROOVE`, as a fraction of it. */
const loopFraction = (fraction: number) => GROOVE_LOOP_SECONDS * fraction

/** Move the audio clock, then let the page repaint from where it now reads. */
async function advance(seconds: number) {
  fake.advance(seconds)
  await act(async () => {
    frame()
  })
}

/** Press the control, and wait for the groove to be sounding. */
async function play(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Play the loop' }))
  await screen.findByRole('button', { name: 'Stop the loop' })
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
    // Default persistence: empty store, save resolves.
    mockStore.get.mockReset().mockResolvedValue(null)
    mockStore.getAll.mockReset().mockResolvedValue([])
    mockStore.save.mockReset().mockResolvedValue(undefined)
    // A buffer a little longer than the music, as the real files are: the mp3
    // carries encoder delay at its head and padding at its tail.
    frame = installFrames()
    fake = installFakeAudioContext({ bufferSeconds: GROOVE_LOOP_SECONDS + 0.1 })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('renders a play control and the guessing card (R1, R2, AC1)', async () => {
    await renderPuzzle()

    expect(screen.getByRole('button', { name: /play/i })).toBeInTheDocument()
    expect(within(rootGroup()).getAllByRole('button')).toHaveLength(12)
    expect(within(flavourGroup()).getAllByRole('button')).toHaveLength(4)
    // The retired subset-guessing model is gone.
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
  })

  // Epic 4, Step I1 — the jazz face is the page's masthead and nothing else.
  // The h1 takes it; every heading inside the page, the groove's own name
  // included, stays on the serif. Asserted through the composed page because
  // the split only means anything here, where several sizes appear at once.
  it('sets only the page title in the jazz face (E4 R1, AC1b)', async () => {
    await renderPuzzle()

    expect(
      screen.getByRole('heading', { level: 1, name: 'Daily Groove' }).className,
    ).toMatch(/font-jazz/)
  })

  it('leaves every heading inside the page on the serif (E4 R1a, R2, AC1b)', async () => {
    await renderPuzzle()

    for (const heading of [
      screen.getByRole('heading', { level: 2, name: 'Test Groove' }),
      screen.getByRole('heading', { level: 3, name: 'What is it?' }),
    ]) {
      expect(heading.className, heading.textContent ?? '').toMatch(/font-display/)
      expect(heading.className, heading.textContent ?? '').not.toMatch(/font-jazz/)
    }
  })

  it('leaves the nudge’s revealed root on the serif (E4 R2, AC2)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'C', wrong)
    await guess(user, 'G', wrong)

    // A hand-lettered E♭ at 15px is the one place legibility outweighs
    // character, so the revealed root keeps `--font-display`.
    const root = within(nudge() as HTMLElement).getByText('C')
    expect(root.className).toMatch(/font-display/)
    expect(root.className).not.toMatch(/font-jazz/)
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
    // The row's empty state went with the row: a first-time player sees the
    // puzzle and nothing below it (E6 R1, AC2).
    expect(screen.queryByText(/no grooves behind you yet/i)).toBeNull()
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
    // A decode that rejects. Fetch failure and a browser with no AudioContext
    // land in the same place — there is one playback path and one error (R7).
    fake.failNextDecode()
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

  it("clears the error and replays today's groove on retry (E6 R4, AC6)", async () => {
    fake.failNextDecode()
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(screen.getByRole('button', { name: /play the loop/i }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /retry/i }))

    expect(
      await screen.findByRole('button', { name: 'Stop the loop' }),
    ).toBeInTheDocument()
    await waitFor(() =>
      expect(screen.queryByRole('alert')).not.toBeInTheDocument(),
    )
    // Retry is the same press as the control: it asks the transport to play,
    // and the only groove it could mean is today's (E6 R4, AC6). A failed
    // press costs no player — the retry reuses the one context.
    expect(fake.contexts).toHaveLength(1)
    expect(fake.sources).toHaveLength(1)
    expect(vi.mocked(fetch).mock.calls.map((call) => call[0])).toEqual([
      GROOVE.audioSrc,
      GROOVE.audioSrc,
    ])
  })

  it('plays, stops and restarts on successive presses (E2 R6, AC5)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    // 1 — starts one looping source and now offers to stop.
    await play(user)
    expect(fake.sources).toHaveLength(1)
    expect(fake.sources[0].start).toHaveBeenCalledTimes(1)
    expect(fake.sources[0].loop).toBe(true)

    // 2 — partway through the loop...
    await advance(loopFraction(0.5))
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50',
    )

    // ...a press halts playback and rewinds it (AC5). Nothing is held.
    await user.click(screen.getByRole('button', { name: 'Stop the loop' }))
    expect(fake.sources[0].stop).toHaveBeenCalledTimes(1)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    expect(
      await screen.findByRole('button', { name: 'Play the loop' }),
    ).toBeInTheDocument()

    // 3 — the next press starts from the beginning, not from bar three (AC9).
    // A buffer source is single-use, so it is a second node over the *same*
    // decoded buffer: one context, one fetch, one decode.
    await play(user)
    expect(fake.sources).toHaveLength(2)
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    expect(fake.contexts).toHaveLength(1)
    expect(fake.fetchCalls).toBe(1)
    expect(fake.decodeCalls).toBe(1)
  })

  // Step C5 — R5, AC6: the fill, not only the highlight. `isPlaying` used to
  // gate the highlighted segment alone while the fill swept regardless, which
  // is how a groove nobody was listening to drew the picture.
  it('returns the progress track to the start on stop (E2 R6a, AC5a, AC6)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    // Before any press the fill is empty, not merely unhighlighted.
    expect(screen.getByTestId('progress-fill')).toHaveAttribute('width', '0%')

    await play(user)
    await advance(loopFraction(0.5))

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

    // ...and returns to the start: no segment highlighted, and the fill itself
    // back to zero rather than holding its last value (AC6).
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '0',
    )
    expect(screen.queryByTestId('progress-active')).not.toBeInTheDocument()
    expect(screen.getByTestId('progress-fill')).toHaveAttribute('width', '0%')

    // The clock running on does not revive it either.
    await advance(loopFraction(0.25))
    expect(screen.getByTestId('progress-fill')).toHaveAttribute('width', '0%')
  })

  it('reads "■ Stop" while the groove sounds (E2 R4a, AC3a)', async () => {
    // The words are supplied by this feature, not by the design system, so the
    // sounding half of that pair is only asserted here. Without this, a
    // regression that dropped `text.stop` would leave the whole suite green.
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

  it("moves the bar highlight with the player's position (D5, AC8, AC2, AC3)", async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await play(user)
    // The sounding bar is the highlighted segment on the track; the bar labels
    // that used to carry it were removed with the rest of the card's chrome.
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '0',
    )

    // Three eighths of the way through the loop is bar 2 (AC3).
    await advance(loopFraction(0.375))
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '1',
    )

    await advance(loopFraction(0.6 - 0.375))
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '2',
    )

    // A whole loop later it is back in the same bar, not pinned at the end:
    // the position wraps rather than clamping at 1 (AC2).
    await advance(loopFraction(1))
    expect(screen.getByTestId('progress-active')).toHaveAttribute(
      'data-segment',
      '2',
    )
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '60',
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

  // --- Feature 6, Epic 1: the page ends at the puzzle -----------------------

  /** A solved day, N days back, played against a known groove. */
  function solvedDay(daysAgo: number): DailyResult {
    return {
      date: isoDate(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)),
      answer: { root: 'G', flavour: 'Dorian' },
      attempts: [SOLVING],
      solved: true,
      grooveId: 'groove-02',
    }
  }

  /** Enough history that a played-grooves row would be unmissable. */
  const fiveSolvedDays = () => [1, 2, 3, 4, 5].map(solvedDay)

  /** The puzzle's own landmark — the whole of what the page renders. */
  const page = () => screen.getByRole('region', { name: 'Daily Groove' })

  it('renders no played-grooves section, however deep the history (E6 R1, AC1)', async () => {
    mockStore.get.mockResolvedValue(null)
    mockStore.getAll.mockResolvedValue(fiveSolvedDays())

    await renderFeature()

    expect(screen.queryByText(/Grooves you.{0,3}ve played/)).toBeNull()
    // Nothing renders below the cards: the archive was the page's only nested
    // section, so its absence is what "the page ends at the puzzle" means.
    expect(page().querySelectorAll('section')).toHaveLength(0)
  })

  it('renders no empty-state card on a first run either (E6 R1, AC2)', async () => {
    await renderFeature()

    expect(screen.queryByText(/Grooves you.{0,3}ve played/)).toBeNull()
    expect(screen.queryByText(/no grooves behind you yet/i)).toBeNull()
    expect(page().querySelectorAll('section')).toHaveLength(0)
  })

  it('puts exactly one play control on the page (E6 R2, AC3)', async () => {
    mockStore.get.mockResolvedValue(null)
    mockStore.getAll.mockResolvedValue(fiveSolvedDays())

    await renderFeature()

    expect(
      screen.getAllByRole('button', { name: /play|stop/i }),
    ).toHaveLength(1)
  })

  // --- Today's groove, through the page transport ---------------------------

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

  it("plays today's groove through the page transport (E5 R3, R4, AC3)", async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(todayControl())
    await screen.findByRole('button', { name: 'Stop the loop' })

    // The file the page fetched is today's groove, and one source sounds it,
    // looping between that groove's own boundaries (R12).
    expect(fetch).toHaveBeenCalledWith(GROOVE.audioSrc)
    expect(fake.sources).toHaveLength(1)
    expect(fake.sources[0].loop).toBe(true)
    expect(nameOf(todayControl())).toBe('Stop the loop')

    // ...and pressing it again stops that same source rather than a second one.
    await user.click(todayControl())
    expect(fake.sources[0].stop).toHaveBeenCalledTimes(1)
    expect(fake.contexts).toHaveLength(1)
    expect(soundingControls()).toEqual([])
  })

  // Step C4 — R7a, AC8b, AC8c. Web Audio has no progressive playback, so a
  // press means fetch, then decode, then sound. The control has to say so
  // rather than sitting in "Stop" over silence.
  it('shows an inert loading control until the first sound (E2 R7a, AC8b, AC8c)', async () => {
    fake.deferNextDecode()
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(screen.getByRole('button', { name: 'Play the loop' }))

    const busy = await screen.findByRole('button', { name: 'Loading…' })
    expect(busy).toBeDisabled()
    expect(busy).toHaveTextContent('Loading…')
    // Nothing sounds yet, and a further press starts nothing (R10, AC10).
    expect(fake.sources).toHaveLength(0)
    await user.click(busy)
    expect(fake.sources).toHaveLength(0)

    await act(async () => {
      fake.releaseDecodes()
    })

    const stop = await screen.findByRole('button', { name: 'Stop the loop' })
    expect(stop).toBeEnabled()
    expect(stop).toHaveTextContent('■ Stop')
    expect(fake.sources).toHaveLength(1)
  })

  // Step I0 — R4, AC5: the head delay is the groove's own, off its manifest
  // entry. No constant is shared across the catalogue, so a groove minted
  // under a different encoder loops correctly with no code change.
  it("starts the loop at this groove's own head delay (R4, AC5)", async () => {
    const user = userEvent.setup()
    await renderPuzzle(
      <GroovePuzzle groove={{ ...GROOVE, headDelaySeconds: 0.05 }} />,
    )

    await play(user)

    const source = fake.sources[0]
    expect(source.loopStart).toBeCloseTo(0.05, 6)
    expect(source.loopEnd - source.loopStart).toBeCloseTo(
      GROOVE_LOOP_SECONDS,
      5,
    )
    // The first pass skips the encoder delay too, not only the repeats.
    expect(source.start).toHaveBeenCalledWith(0, 0.05)
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
