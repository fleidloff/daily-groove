import type { ReactElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
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
// Only the module singleton is stood in for: `createReadOnlyStore` stays the
// real decorator, because the shared session below is the real one.
vi.mock('../lib/persistence/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/persistence/storage')>()),
  createLocalStore: () => mockStore,
}))

import { GroovePuzzle } from './GroovePuzzle'
import {
  answerOf,
  flavourOptions,
  ROOTS,
  simpleRootOptions,
} from '../lib/theory/music'
import { createLocalPreferenceStore } from '../lib/persistence/preferences'
import { dateLine } from '../lib/presentation/date'
import { barChords } from '../lib/theory/changes'
import { isoDate, selectGrooveForDate } from '../lib/puzzle/selectGroove'
import { GROOVES } from '../data/grooves.generated'
import { NOTES } from '../data/notes.generated'
import { renderFeature } from '../testing/renderFeature'
import { APP_NAME } from '@/lib/branding'
import {
  installFakeAudioContext,
  type FakeContext,
} from '../testing/fakeAudioContext'

const GROOVE: Groove = {
  id: 'groove-01',
  uuid: '61607a6c-3f9e-4fd7-9724-99ea22d32e4a',
  audioSrc: '/grooves/groove-01.mp3',
  name: 'Test Groove',
  bpm: 90,
  root: 'C',
  flavour: 'Aeolian',
  bars: 4,
  scale: 'C Aeolian',
  chord: 'Cm7',
  progression: 'Cm–Fm–G7',
  headDelaySeconds: 0.025057,
}

/**
 * How the solved panel's lead sheet reads out. Feature-11 Epic 1 turned the
 * changes from two chips into four ruled bars, so the day's harmony is checked
 * through the sheet's accessible name rather than through printed chip text.
 */
const CHANGES_READ = 'Cm · Fm · G7 · Cm'

/** The day's four flavour chips, resolved exactly as the component resolves them. */
const flavours = () => flavourOptions(new Date(), GROOVE)
/** A flavour that is on offer today but is not the answer. */
const wrongFlavour = () => flavours().find((f) => f !== 'Aeolian') as string
/** A second wrong flavour, so a third guess can differ from the second. */
const otherWrongFlavour = () =>
  flavours().filter((f) => f !== 'Aeolian' && f !== wrongFlavour())[0]

const TODAY = () => isoDate(new Date())

function miss(root: Root, flavour: string, rootMatched: boolean): Attempt {
  return { root, flavour, correct: false, rootMatched, flavourMatched: false }
}

const SOLVING: Attempt = {
  root: 'C',
  flavour: 'Aeolian',
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

/** The note glyph the root row wears (F10 E2 R1). */
const NOTE_GLYPH = '♪'

/**
 * The caption under the play control, verbatim (F10 E2 R1a, AC6). Feature-4
 * Epic 2 put it below the control; this is the wording that replaced its own.
 */
const CAPTION =
  'Find the note that feels like home — Play along with your instrument or tap a root to hear it.'

/**
 * A chip's label with its decorative adornment left out. The glyph is
 * `aria-hidden`, so this is the chip's accessible name — which is what every
 * assertion about *which* chips a row offers has always been about (F10 E2 R4).
 */
const chipLabel = (chip: Element) =>
  Array.from(chip.childNodes)
    .filter(
      (node) =>
        !(node instanceof Element && node.getAttribute('aria-hidden') === 'true'),
    )
    .map((node) => node.textContent ?? '')
    .join('')

/** The adornment a chip carries, or `null` when it carries none. */
const chipAdornment = (chip: Element) =>
  chip.querySelector('[aria-hidden="true"]')?.textContent ?? null

const rootGroup = () => screen.getByRole('radiogroup', { name: 'Root' })
// The second row holds modes and says so (F7 E4 R1, AC1). The helper is named
// for the domain field behind it — `flavour` on the groove — which the rename
// deliberately left alone.
const flavourGroup = () => screen.getByRole('radiogroup', { name: 'Mode' })
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

    expect(screen.getByRole('button', { name: /^play the loop$/i })).toBeInTheDocument()
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
      screen.getByRole('heading', { level: 1, name: APP_NAME }).className,
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
      expect(rendered).toContain('Aeolian')
    } finally {
      vi.useRealTimers()
    }
  })

  it('offers all twelve roots every day (R2)', async () => {
    await renderPuzzle()
    expect(within(rootGroup()).getAllByRole('button').map(chipLabel)).toEqual(
      ROOTS,
    )
  })

  it('drives the whole guess flow through the real store (R5, R7, R10, R11, R12)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    const wrong = wrongFlavour()

    // 1 — nothing chosen: the control prompts and is disabled (AC6).
    expect(control()).toHaveAccessibleName('Pick a root and a mode')
    expect(control()).toBeDisabled()

    // 2 — a root alone is not enough (R7).
    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
    expect(control()).toHaveAccessibleName('Pick a root and a mode')
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
    await user.click(within(flavourGroup()).getByRole('button', { name: 'Aeolian' }))
    expect(control()).toHaveAccessibleName('Check C Aeolian')
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
    expect(pressed.map(chipLabel)).toEqual(['G'])
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
    expect(screen.getByText(/not it\. keep playing/i)).toBeInTheDocument()
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

  // Feature-7 Epic 3 R4: the nudge names the day's root in prose, and from this
  // epic on it also *presses the chip*. Before, this test asserted the opposite
  // — that the revealed root was left for the player to go and find — which was
  // the busywork on already-surrendered information the epic set out to remove.
  // Everything else the test guarded is unchanged: no chip is filtered away,
  // locked, or marked as already tried (F7 E3 R5, AC5).
  it('hands the day\u2019s root over as a selection when the nudge arrives (F7 E3 R4, R5, AC3, AC5)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'C', wrong)
    await guess(user, 'G', wrong)
    expect(nudge()).toBeInTheDocument()

    const chips = within(rootGroup()).getAllByRole('button')
    // All twelve are still on offer — none filtered away, none locked (AC5).
    expect(chips).toHaveLength(12)
    for (const chip of chips) expect(chip).toBeEnabled()
    // The second miss selects the answer's root, replacing the player's own
    // last choice rather than sitting beside it (AC3).
    expect(
      chips
        .filter((b) => b.getAttribute('aria-pressed') === 'true')
        .map(chipLabel),
    ).toEqual(['C'])
    expect(
      within(rootGroup()).getByRole('button', { name: 'G' }),
    ).toHaveAttribute('aria-pressed', 'false')
    // No chip is marked as already tried — 'C' and 'G' have both been guessed
    // and neither carries any state beyond aria-pressed.
    expect(chips.filter((b) => b.getAttribute('aria-disabled') === 'true')).toEqual(
      [],
    )
  })

  // Step D2's second half — R5, AC4. The selection is a gift, not a lock: the
  // rule fires once, and what the player does with the chip afterwards is
  // theirs, including through a further miss.
  it('lets the player overrule the auto-selected root, and keeps their choice (F7 E3 R5, AC4)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()
    const other = otherWrongFlavour()

    await guess(user, 'C', wrong)
    await guess(user, 'G', wrong)
    expect(
      within(rootGroup()).getByRole('button', { name: 'C' }),
    ).toHaveAttribute('aria-pressed', 'true')

    // The player disagrees, and the chips let them.
    await user.click(within(rootGroup()).getByRole('button', { name: 'D' }))
    expect(
      within(rootGroup()).getByRole('button', { name: 'D' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(rootGroup()).getByRole('button', { name: 'C' }),
    ).toHaveAttribute('aria-pressed', 'false')
    // The control follows the selection, so the pair it names is the new one.
    expect(control()).toHaveAccessibleName(`Check D ${wrong}`)

    // ...and a third miss does not hand the root back: the rule fired once.
    await user.click(within(flavourGroup()).getByRole('button', { name: other }))
    await user.click(control())
    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    expect(
      within(rootGroup()).getByRole('button', { name: 'D' }),
    ).toHaveAttribute('aria-pressed', 'true')
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

    await guess(user, 'C', 'Aeolian')

    expect(nudge()).not.toBeInTheDocument()
    expect(screen.getByText(/the groove is yours now/i)).toBeInTheDocument()
    expect(dotStates()).toEqual(['solved', 'solved', 'solved'])
  })

  // --- Feature 7, Epic 3: giving up ----------------------------------------

  /**
   * The way out, in whichever state it is currently in. Queried by role and
   * name like every other control on the page, so a test never has to know
   * which of the two labels is showing.
   */
  const giveUp = () =>
    screen.queryByRole('button', {
      name: /give up and show the answer|end the day and show the answer/i,
    })

  /**
   * The answer panel, found through the heading it leads with. The page carries
   * more than one live region — the transport announces itself too — so the
   * panel is located by its own content rather than by role alone.
   */
  const solutionPanel = () =>
    screen
      .getByRole('heading', { name: 'C Aeolian' })
      .closest('[role="status"]') as HTMLElement

  it('offers the way out only from the third miss, and ends the day on the second press (F7 E3 R6, R7, R8, AC6, AC8a)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    // One miss, then two: still no way out on offer (AC6).
    await guess(user, 'C', wrong)
    expect(giveUp()).toBeNull()
    await guess(user, 'G', wrong)
    expect(giveUp()).toBeNull()

    // The third miss puts it on the card (AC6).
    await guess(user, 'G', otherWrongFlavour())
    expect(giveUp()).toHaveAccessibleName('Give up and show the answer')

    // One press only arms it: the answer is still withheld and the day is
    // still in progress (AC8).
    await user.click(giveUp() as HTMLElement)
    expect(giveUp()).toHaveAccessibleName(
      'Yes \u2014 end the day and show the answer',
    )
    expect(
      screen.queryByRole('heading', { name: 'C Aeolian' }),
    ).not.toBeInTheDocument()

    // The second press ends it: the whole solution is on screen, without the
    // claim of a win (AC8a, AC10, AC10a).
    await user.click(giveUp() as HTMLElement)
    const panel = solutionPanel()
    expect(panel).toBeInTheDocument()
    expect(within(panel).getByText(/given up/i)).toBeInTheDocument()
    expect(screen.queryByText(/solved in/i)).toBeNull()
    expect(screen.queryByText(/streak now/i)).toBeNull()
    expect(
      within(panel).getByRole('img', { name: CHANGES_READ }),
    ).toBeInTheDocument()

    // ...the offer itself is gone, and so is the way back in (AC8a).
    expect(giveUp()).toBeNull()
    expect(control()).toBeDisabled()
    await user.click(within(rootGroup()).getByRole('button', { name: 'A' }))
    expect(
      within(rootGroup()).getByRole('button', { name: 'A' }),
    ).toHaveAttribute('aria-pressed', 'false')
    await user.click(
      within(flavourGroup()).getByRole('button', { name: 'Aeolian' }),
    )
    expect(
      within(flavourGroup()).getByRole('button', { name: 'Aeolian' }),
    ).toHaveAttribute('aria-pressed', 'false')

    // The three misses are all it cost: giving up is not a fourth attempt, and
    // the day was written down as given up (R8, R9).
    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    const saved = mockStore.save.mock.calls.at(-1)?.[0] as DailyResult
    expect(saved.attempts).toHaveLength(3)
    expect(saved.solved).toBe(false)
    expect(saved.revealed).toBe(true)
  })

  it('reopens a revealed day on the terminal state, not a fresh puzzle (F7 E3 R8, AC9)', async () => {
    const wrong = wrongFlavour()
    const stored: DailyResult = {
      date: TODAY(),
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [
        miss('C', wrong, true),
        miss('G', wrong, false),
        miss('G', otherWrongFlavour(), false),
      ],
      solved: false,
      revealed: true,
    }
    mockStore.get.mockResolvedValue(stored)
    mockStore.getAll.mockResolvedValue([stored])

    const user = userEvent.setup()
    await renderPuzzle()

    // The answer is on screen from the first painted frame, with no win claimed.
    const panel = solutionPanel()
    expect(panel).toBeInTheDocument()
    expect(within(panel).getByText(/given up/i)).toBeInTheDocument()
    expect(
      within(panel).getByRole('img', { name: CHANGES_READ }),
    ).toBeInTheDocument()
    expect(
      within(panel).getByRole('group', { name: /notes to live in/i }),
    ).toBeInTheDocument()
    expect(screen.queryByText(/solved in/i)).toBeNull()

    // The puzzle is not playable: nothing to give up on, nothing to check, and
    // the chips do not move.
    expect(giveUp()).toBeNull()
    expect(control()).toBeDisabled()
    await user.click(within(rootGroup()).getByRole('button', { name: 'A' }))
    expect(
      within(rootGroup()).getByRole('button', { name: 'A' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    // Reading the day back writes nothing.
    expect(mockStore.save).not.toHaveBeenCalled()
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
      screen.queryByRole('heading', { name: 'C Aeolian' }),
    ).not.toBeInTheDocument()
  })

  it('opens the solved panel with the answer, the tries and the changes (E4 R1-R5, AC1, AC3, AC4)', async () => {
    const user = userEvent.setup()
    const { container } = await renderPuzzle()

    await guess(user, 'C', wrongFlavour())
    await guess(user, 'C', 'Aeolian')

    expect(
      screen.getByRole('heading', { name: 'C Aeolian' }),
    ).toBeInTheDocument()
    // Two attempts were spent, and today's solve is the streak's first day.
    expect(screen.getByText(/solved in 2 tries/i)).toBeInTheDocument()
    expect(screen.getByText(/streak now 1/i)).toBeInTheDocument()
    expect(
      within(container).getByRole('img', { name: CHANGES_READ }),
    ).toBeInTheDocument()
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
      screen.queryByRole('heading', { name: 'C Aeolian' }),
    ).not.toBeInTheDocument()
  })

  // "writes the day after every check, not only on a solve (E5 R2, AC1)" moved
  // to `hooks/usePuzzleSession.test.ts`: it asserts on the saved record alone,
  // and needs no region of the page rendered to hold.

  it('restores the attempts spent on a reload mid-game (E5 R3, AC1, AC2)', async () => {
    const wrong = wrongFlavour()
    const stored: DailyResult = {
      date: TODAY(),
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [miss('C', wrong, true), miss('G', wrong, false)],
      solved: false,
    }
    mockStore.get.mockResolvedValue(stored)
    mockStore.getAll.mockResolvedValue([stored])

    const user = userEvent.setup()
    await renderPuzzle()

    // Two dots are still spent, and the feedback matches the second guess.
    expect(dotStates()).toEqual(['spent', 'spent', 'unspent'])
    expect(screen.getByText(/not it\. keep playing/i)).toBeInTheDocument()
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
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [SOLVING],
      solved: true,
    }
    mockStore.get.mockResolvedValue(stored)
    mockStore.getAll.mockResolvedValue([stored])

    const user = userEvent.setup()
    await renderPuzzle()

    expect(screen.getByRole('heading', { name: 'C Aeolian' })).toBeInTheDocument()
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
    expect(control()).toHaveAccessibleName('Pick a root and a mode')
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

  // --- Feature 7, Epic 5: simple mode --------------------------------------

  /** A day whose mode is minor, and a day whose mode is major. */
  const DORIAN: Groove = { ...GROOVE, flavour: 'Dorian', scale: 'C Dorian' }
  const MIXOLYDIAN: Groove = {
    ...GROOVE,
    flavour: 'Mixolydian',
    scale: 'C Mixolydian',
  }

  /**
   * Turn the preference on before the page reads it, through the same
   * `PreferenceStore` the hook behind the toggle uses. No hook and no component
   * is mocked: the page loads the preference the way it will in a browser.
   */
  async function enableSimpleMode() {
    await createLocalPreferenceStore().set({ simpleMode: true })
  }

  const modeSwitch = () => screen.getByRole('switch', { name: /simple mode/i })

  /** The six roots the day offers in simple mode, resolved as the page does. */
  const simpleRoots = () => simpleRootOptions(new Date(), answerOf(DORIAN))

  const chipTexts = (group: HTMLElement) =>
    within(group).getAllByRole('button').map(chipLabel)

  const MODE_NAME = /ionian|dorian|phrygian|lydian|mixolydian|aeolian|locrian/i

  it('does not let a switch leave an unofferable pair checkable (E5 R4, R8)', async () => {
    const user = userEvent.setup()
    await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

    // Choose a full-puzzle pair whose mode simple mode does not offer, and
    // whose root the day's six need not contain.
    const staleRoot = ROOTS.find((r) => !simpleRoots().includes(r)) as Root
    await user.click(within(rootGroup()).getByRole('button', { name: staleRoot }))
    await user.click(within(flavourGroup()).getByRole('button', { name: 'Dorian' }))
    expect(control()).toHaveAccessibleName(`Check ${staleRoot} Dorian`)
    expect(control()).toBeEnabled()

    await user.click(modeSwitch())

    // Neither half is on offer any more, so neither reads as chosen and the
    // control cannot spend an attempt on a pair that is not on screen.
    expect(chipTexts(rootGroup())).not.toContain(staleRoot)
    expect(
      within(rootGroup()).queryByRole('button', { pressed: true }),
    ).toBeNull()
    expect(
      within(flavourGroup()).queryByRole('button', { pressed: true }),
    ).toBeNull()
    expect(control()).toHaveAccessibleName('Pick a root and a mode')
    expect(control()).toBeDisabled()

    // The choice was hidden, not thrown away: toggling back restores it, so a
    // mid-day switch stays lossless (R8).
    await user.click(modeSwitch())
    expect(control()).toHaveAccessibleName(`Check ${staleRoot} Dorian`)
    expect(control()).toBeEnabled()
  })

  it('narrows both rows to six roots and two families in simple mode (E5 R2, R3, R4, AC2, AC3)', async () => {
    await enableSimpleMode()
    await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

    // Six, deterministic for the date, and the answer's root among them — the
    // same six `simpleRootOptions` resolves for today (AC2).
    expect(chipTexts(rootGroup())).toEqual(simpleRoots())
    expect(chipTexts(rootGroup())).toHaveLength(6)
    expect(chipTexts(rootGroup())).toContain('C')

    // Exactly two, reading `Major` and `Minor` (AC3).
    expect(chipTexts(flavourGroup())).toEqual(['Major', 'Minor'])

    // ...and no mode name is on screen in either row.
    expect(rootGroup().textContent).not.toMatch(MODE_NAME)
    expect(flavourGroup().textContent).not.toMatch(MODE_NAME)
  })

  it('offers all twelve roots and four modes with simple mode off (E5 R2, R4, AC2, AC3)', async () => {
    await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

    expect(chipTexts(rootGroup())).toEqual(ROOTS)
    expect(chipTexts(flavourGroup())).toEqual(flavourOptions(new Date(), DORIAN))
    expect(chipTexts(flavourGroup())).toHaveLength(4)
    // The families are not on offer in the full puzzle.
    expect(chipTexts(flavourGroup())).not.toContain('Minor')
    expect(chipTexts(flavourGroup())).not.toContain('Major')
  })

  it('solves a Dorian day from its root and the minor option (E5 R5, AC4)', async () => {
    await enableSimpleMode()
    const user = userEvent.setup()
    await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

    await guess(user, 'C', 'Minor')

    expect(screen.getByText(/the groove is yours now/i)).toBeInTheDocument()
    expect(control()).toHaveAccessibleName('Solved')
    // The panel names the day's real mode: simple mode narrowed the question,
    // not the answer.
    expect(screen.getByRole('heading', { name: 'C Dorian' })).toBeInTheDocument()
  })

  it('misses a Mixolydian day guessed minor (E5 R5, AC5)', async () => {
    await enableSimpleMode()
    const user = userEvent.setup()
    await renderPuzzle(<GroovePuzzle groove={MIXOLYDIAN} />)

    await guess(user, 'C', 'Minor')

    expect(screen.queryByText(/the groove is yours now/i)).toBeNull()
    expect(dotStates()).toEqual(['spent', 'unspent', 'unspent'])
    // The root half is still reported as the half that matched.
    expect(screen.getByText(/right home note/i)).toBeInTheDocument()

    // ...and the major option solves the same day.
    await user.click(within(flavourGroup()).getByRole('button', { name: 'Major' }))
    await user.click(control())
    expect(screen.getByText(/the groove is yours now/i)).toBeInTheDocument()
  })

  it('keeps the day when the toggle is flipped mid-play (E5 R8, R8a, AC8, AC8a)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const wrong = wrongFlavour()

    await guess(user, 'C', wrong)
    await guess(user, 'G', wrong)
    expect(dotStates()).toEqual(['spent', 'spent', 'unspent'])
    const writes = mockStore.save.mock.calls.length

    // The switch is still operable on a day two attempts in (AC8a).
    expect(modeSwitch()).toBeEnabled()
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'false')
    await user.click(modeSwitch())
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')

    // The day survived the switch: the same two dots, the same groove, and no
    // attempt invented or lost (AC8).
    expect(dotStates()).toEqual(['spent', 'spent', 'unspent'])
    expect(mockStore.save.mock.calls).toHaveLength(writes)
    expect(mockStore.save.mock.calls.at(-1)?.[0].attempts).toHaveLength(2)
    expect(
      screen.getByRole('heading', { level: 2, name: 'Test Groove' }),
    ).toBeInTheDocument()
    // The nudge those two misses earned is still there.
    expect(nudge()).toBeInTheDocument()

    // Only the question narrowed.
    expect(chipTexts(rootGroup())).toHaveLength(6)
    expect(chipTexts(flavourGroup())).toEqual(['Major', 'Minor'])

    // The third guess is the third attempt, and it is graded the new way.
    await user.click(within(flavourGroup()).getByRole('button', { name: 'Minor' }))
    await user.click(control())
    expect(dotStates()).toEqual(['solved', 'solved', 'solved'])
    expect(screen.getByText(/the groove is yours now/i)).toBeInTheDocument()
    expect(mockStore.save.mock.calls.at(-1)?.[0].attempts).toHaveLength(3)

    // ...and the switch settles once the day is over: it keeps the position the
    // day was played in and stops responding (F11 E4 R1, R4, AC1). Feature-7's
    // R8a covered the whole day; feature-11 narrows it to the playable one, and
    // the live half is asserted above, two attempts in.
    expect(modeSwitch()).toBeDisabled()
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
    await user.click(modeSwitch())
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
  })

  it('keeps the nudge and the way out at the same thresholds in simple mode (E5 R10, AC10)', async () => {
    await enableSimpleMode()
    const user = userEvent.setup()
    await renderPuzzle()
    const [wrongRoot, otherWrongRoot] = simpleRoots().filter((r) => r !== 'C')

    await guess(user, wrongRoot, 'Major')
    expect(nudge()).not.toBeInTheDocument()
    expect(giveUp()).toBeNull()

    // Two misses: the nudge names the day's root, in prose and as a selection.
    await guess(user, otherWrongRoot, 'Major')
    const box = nudge() as HTMLElement
    expect(box).toBeInTheDocument()
    expect(box.textContent).toMatch(/root is C\./)
    expect(
      within(rootGroup()).getByRole('button', { name: 'C' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(giveUp()).toBeNull()

    // Three: the way out is offered, at exactly the same point as ever.
    await user.click(control())
    expect(dotStates()).toEqual(['spent', 'spent', 'spent'])
    expect(giveUp()).toHaveAccessibleName('Give up and show the answer')
  })

  it('records a day solved in simple mode as solved, and counts it (E5 R9, AC9)', async () => {
    await enableSimpleMode()
    const user = userEvent.setup()
    await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

    await guess(user, 'C', 'Minor')

    const saved = mockStore.save.mock.calls.at(-1)?.[0] as DailyResult
    expect(saved.solved).toBe(true)
    expect(saved.revealed).toBeUndefined()
    expect(saved.answer).toEqual({ root: 'C', flavour: 'Dorian' })
    // A solve is a solve: the day counts toward the streak like any other.
    expect(screen.getByText(/streak now 1/i)).toBeInTheDocument()
  })

  it('carries the preference into the page it opens with (E5 R7, AC7)', async () => {
    await enableSimpleMode()
    await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

    // No press needed: the stored preference is what the first painted card
    // shows, so a reload the next day opens in simple mode.
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
    expect(chipTexts(flavourGroup())).toEqual(['Major', 'Minor'])
  })

  // --- Epic 1/2 regressions -------------------------------------------------

  it('shows an error with retry when playback rejects, the card stays (R7)', async () => {
    // A decode that rejects. Fetch failure and a browser with no AudioContext
    // land in the same place — there is one playback path and one error (R7).
    fake.failNextDecode()
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(screen.getByRole('button', { name: /^play the loop$/i }))

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
    // Filtered to the groove's own file: since F10 E1 the page also warms the
    // twelve reference notes once the groove has decoded, and those are a
    // different subject. What is asserted is unchanged — the failed press and
    // the retry each asked for today's groove, and for nothing else.
    expect(
      vi
        .mocked(fetch)
        .mock.calls.map((call) => String(call[0]))
        .filter((url) => !url.startsWith('/notes/')),
    ).toEqual([GROOVE.audioSrc, GROOVE.audioSrc])
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
    // The *groove's* file, once. Counted per URL rather than off the fake's
    // running total: since F10 E1 the page also warms the twelve reference
    // notes once the groove has decoded, and those are a different subject.
    // What this asserts is unchanged — replaying re-uses the decoded buffer.
    const grooveFetches = vi
      .mocked(fetch)
      .mock.calls.filter((call) => String(call[0]) === GROOVE.audioSrc)
    expect(grooveFetches).toHaveLength(1)
    // One decode per file fetched, and never a second one of the same file.
    expect(fake.decodeCalls).toBe(fake.fetchCalls)
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
    // F10 E2 Step I1 — the only place the old wording was asserted. R1a
    // replaced the string and nothing else: the caption is still the control's
    // next sibling, in a column, which is the half of feature-4 E2 R4 that
    // still stands.
    expect(play.nextElementSibling).toHaveTextContent(CAPTION)
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

  // Feature-7 Epic 2 put the tempo back on the card: it is the one piece of the
  // retired meta line backed by data worth showing, and a player reading "90
  // bpm" knows what they are about to hear. The day was later repeated beside
  // it, so the caption is one line carrying both. The rest of that line stays
  // gone — `GrooveCard.test.tsx` still holds "renders no meta line beneath the
  // name".
  it('renders the groove card header, the tempo, the day and the transport (E1 R5, AC5)', async () => {
    await renderPuzzle()
    expect(
      screen.getByRole('heading', { name: GROOVE.name }),
    ).toBeInTheDocument()
    // Lower-case `bpm`, as a caption beneath the name — not the old `BPM` cell.
    // Matched by pattern because the day follows it and the page uses the real
    // today; `GrooveCard.test.tsx` pins the exact wording against a fixed date.
    expect(
      screen.getByText(new RegExp(`^${GROOVE.bpm} bpm · `)),
    ).toBeInTheDocument()
    // The day appears exactly once, beside the tempo: the header stopped
    // carrying its own copy, so the card is the page's only statement of the
    // day (F8 E1 R13, AC11).
    expect(screen.getAllByText(new RegExp(dateLine(new Date())))).toHaveLength(1)
    expect(screen.queryByText('BPM')).not.toBeInTheDocument()
    // The tempo sits outside the heading, so the name is still the whole of the
    // heading's accessible name.
    expect(
      screen.getByRole('heading', { name: GROOVE.name }),
    ).not.toHaveTextContent('bpm')
    expect(screen.getByRole('progressbar')).toBeInTheDocument()
  })

  it('renders the header with the streak beside the puzzle (E1 R1a, R2, R3, AC1a, AC2, AC3)', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 7, 29, 12, 0, 0))
      await renderPuzzle()

      expect(
        screen.getByRole('heading', { level: 1, name: APP_NAME }),
      ).toBeInTheDocument()
      // The header shows no date of its own: the day is the card's line,
      // where it reads `<bpm> bpm · <day>` (F8 E1 R11, R13, AC9, AC11).
      expect(screen.queryByText('Saturday, 29 August')).toBeNull()
      expect(
        screen.getByText(/· Saturday, 29 August$/),
      ).toBeInTheDocument()
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

  it('names its landmark for the app in both branches (F8 E1 R8, AC6)', async () => {
    // Rendered but not settled: the store read has not resolved, so this is the
    // loading branch.
    const { unmount } = render(<GroovePuzzle groove={GROOVE} />)
    expect(screen.getByText(/loading/i)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: APP_NAME })).toBeInTheDocument()
    await settle()
    // ...and the loaded branch says the same word.
    expect(screen.getByRole('region', { name: APP_NAME })).toBeInTheDocument()
    unmount()
  })

  it('reads a pre-rename store back unchanged (F8 E1 R9, AC7)', async () => {
    // A regression pin, not a behaviour change: the epic renames the page, not
    // the key. A player's streak lives under `daily-groove:v2:results` and must
    // survive a "rename everything" sweep untouched.
    const { createLocalStore } = await vi.importActual<
      typeof import('../lib/persistence/storage')
    >('../lib/persistence/storage')

    const day = (daysAgo: number): DailyResult => ({
      date: isoDate(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)),
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [SOLVING],
      solved: true,
    })
    const byDate: Record<string, DailyResult> = {}
    for (const daysAgo of [0, 1, 2]) {
      const result = day(daysAgo)
      byDate[result.date] = result
    }
    localStorage.setItem(
      'daily-groove:v2:results',
      JSON.stringify({ version: 2, byDate }),
    )

    // Read through the real localStorage-backed store, so the key itself is
    // what the assertion depends on.
    const real = createLocalStore()
    mockStore.get.mockImplementation((date: string) => real.get(date))
    mockStore.getAll.mockImplementation(() => real.getAll())
    mockStore.save.mockImplementation((result: DailyResult) => real.save(result))

    try {
      await renderPuzzle()

      expect(screen.getByLabelText(/current streak/i)).toHaveTextContent(
        '3 days streak',
      )
      // Nothing migrated it away.
      expect(localStorage.getItem('daily-groove:v2:results')).not.toBeNull()
    } finally {
      localStorage.removeItem('daily-groove:v2:results')
    }
  })

  it('reads "N days streak" once a day has been won (E1 R3, AC3)', async () => {
    const stored: DailyResult = {
      date: TODAY(),
      answer: { root: 'C', flavour: 'Aeolian' },
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
    expect(screen.getByRole('button', { name: /^play the loop$/i })).toBeInTheDocument()
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
  const page = () => screen.getByRole('region', { name: APP_NAME })

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

    // Anchored on the transport control's own name: the header's question mark
    // is named "How to play" (F8 E3 R9) and an unanchored /play/ matches it.
    expect(
      screen.getAllByRole('button', { name: /^(play|stop) the loop$/i }),
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

      // The card renders the day...
      expect(screen.getByText(/· Saturday, 29 August$/)).toBeInTheDocument()
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
      const flavours = screen.getByRole("radiogroup", { name: "Mode" });
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

  /**
   * Feature 8, Epic 3, Track C — the how-to-play box and the question mark that
   * brings it back. Every case here goes through `renderFeature`, the route's
   * own render-and-settle, because who sees the box is a property of the
   * composed page and its saved records rather than of any one component.
   */
  describe('how to play (F8 E3)', () => {
    /** The box, found by its own heading — the `Card` root carries no role. */
    const box = () =>
      screen.queryByRole('heading', { level: 2, name: 'How to play' })
    const helpToggle = () =>
      screen.queryByRole('button', { name: 'How to play' })
    const closeBox = () =>
      screen.getByRole('button', { name: 'Close how to play' })

    /** An ISO day `n` days before today, anchored at noon so DST cannot shift it. */
    function daysAgo(n: number): string {
      const day = new Date()
      day.setHours(12, 0, 0, 0)
      day.setDate(day.getDate() - n)
      return isoDate(day)
    }

    function solvedOn(date: string): DailyResult {
      return {
        date,
        answer: { root: 'C', flavour: 'Aeolian' },
        attempts: [SOLVING],
        solved: true,
      }
    }

    /**
     * Point the mocked persistence seam at the real localStorage-backed store,
     * for the cases where the *storage contents* have to drive the behaviour —
     * a record written by a guess and read back by the next render, and the
     * keys the page is allowed to leave behind.
     */
    async function withRealStorage() {
      const { createLocalStore } = await vi.importActual<
        typeof import('../lib/persistence/storage')
      >('../lib/persistence/storage')
      const real = createLocalStore()
      mockStore.get.mockImplementation((date: string) => real.get(date))
      mockStore.getAll.mockImplementation(() => real.getAll())
      mockStore.save.mockImplementation((result: DailyResult) =>
        real.save(result),
      )
      return real
    }

    /** Seed the real results key with exactly one record on `date`. */
    function seed(date: string) {
      localStorage.setItem(
        'daily-groove:v2:results',
        JSON.stringify({ version: 2, byDate: { [date]: solvedOn(date) } }),
      )
    }

    /** Spend one guess on whatever the day offers, and let the write settle. */
    async function guessSomething(user: ReturnType<typeof userEvent.setup>) {
      await user.click(within(rootGroup()).getAllByRole('button')[0])
      await user.click(within(flavourGroup()).getAllByRole('button')[0])
      await user.click(control())
      await settle()
    }

    // --- Step C4: the right players see it ---------------------------------

    it('greets a player with nothing saved (F8 E3 R1, AC1)', async () => {
      await renderFeature()

      expect(box()).toBeInTheDocument()
    })

    it('says nothing to a player who was here yesterday (F8 E3 R3, AC2)', async () => {
      mockStore.getAll.mockResolvedValue([solvedOn(daysAgo(1))])

      await renderFeature()

      expect(box()).toBeNull()
    })

    it('explains the game again after a month away (F8 E3 R2, AC3)', async () => {
      mockStore.getAll.mockResolvedValue([solvedOn(daysAgo(35))])

      await renderFeature()

      expect(box()).toBeInTheDocument()
    })

    // --- Step C5: it sits under the header, and never before the records ----

    it('follows the masthead and precedes the groove card (F8 E3 R5, AC6)', async () => {
      const { container } = await renderFeature()

      const headings = Array.from(container.querySelectorAll('h1, h2'))
      const groove = selectGrooveForDate(new Date(), GROOVES)
      const at = (text: string) =>
        headings.findIndex((h) => h.textContent === text)

      const masthead = headings.findIndex((h) => h.tagName === 'H1')
      const intro = at('How to play')
      const card = at(groove.name)

      expect(masthead).toBeGreaterThanOrEqual(0)
      expect(intro).toBeGreaterThan(masthead)
      expect(card).toBeGreaterThan(intro)
    })

    it('is not in the first painted frame, before the records load (F8 E3 R11, AC11)', async () => {
      // Rendered but deliberately not settled: the store read has not resolved,
      // so this is the loading branch a returning player would flash through.
      const { unmount } = render(<GroovePuzzle />)

      expect(screen.getByText(/loading/i)).toBeInTheDocument()
      expect(screen.queryByText('How to play')).toBeNull()

      await settle()
      unmount()
    })

    // --- Step C3: playing does not take the instructions away --------------

    it('keeps the box up while a new player guesses (F8 E3 R16, R17, AC15)', async () => {
      const user = userEvent.setup()
      await renderFeature()
      expect(box()).toBeInTheDocument()

      await guessSomething(user)

      // Today's record has just been written, which by the record set alone
      // would make this a returning player. The answer is latched at load.
      expect(mockStore.save).toHaveBeenCalled()
      expect(box()).toBeInTheDocument()
    })

    it('keeps it up for a lapsed player too, and drops it on the next load (F8 E3 R16, AC16)', async () => {
      await withRealStorage()
      seed(daysAgo(35))
      const user = userEvent.setup()

      const first = await renderFeature()
      expect(box()).toBeInTheDocument()

      await guessSomething(user)
      expect(box()).toBeInTheDocument()

      first.unmount()

      // A reload against the same storage: the newest record is now today, so
      // the player is no longer lapsed and the box stays away.
      await renderFeature()
      expect(box()).toBeNull()
    })

    // --- Step C6: close it, and get it back --------------------------------

    it('closes on the box’s own control and comes back on the question mark (F8 E3 R6, R8, AC7, AC8)', async () => {
      const user = userEvent.setup()
      await renderFeature()
      expect(box()).toBeInTheDocument()

      await user.click(closeBox())
      expect(box()).toBeNull()

      await user.click(helpToggle() as HTMLElement)
      expect(box()).toBeInTheDocument()
    })

    it('hides the question mark while the box is up, and returns it on close (F8 E3 R10, AC9a)', async () => {
      const user = userEvent.setup()
      await renderFeature()

      // A new player: the box is up, so there is nothing to ask for.
      expect(box()).toBeInTheDocument()
      expect(helpToggle()).toBeNull()

      await user.click(closeBox())

      // Closed, and the way back appears in the same moment.
      expect(box()).toBeNull()
      expect(helpToggle()).toBeInTheDocument()

      await user.click(helpToggle() as HTMLElement)
      expect(box()).toBeInTheDocument()
      expect(helpToggle()).toBeNull()
    })

    it('offers the question mark to a regular, who can ask for the box (F8 E3 R10, AC9)', async () => {
      mockStore.getAll.mockResolvedValue([solvedOn(daysAgo(1))])
      const user = userEvent.setup()
      await renderFeature()

      expect(box()).toBeNull()
      expect(helpToggle()).toBeInTheDocument()

      await user.click(helpToggle() as HTMLElement)
      expect(box()).toBeInTheDocument()
    })

    it('forgets the dismissal on the next load (F8 E3 R7, AC7)', async () => {
      const user = userEvent.setup()
      const first = await renderFeature()

      await user.click(closeBox())
      expect(box()).toBeNull()
      first.unmount()

      // A reload against the same (still empty) storage: the rule decides
      // again from the records alone, and the records never heard about it.
      await renderFeature()
      expect(box()).toBeInTheDocument()
    })

    // --- Step C7: nothing new is written -----------------------------------

    it('writes no key of its own, however often it is closed (F8 E3 R13, AC13)', async () => {
      // Through the real localStorage-backed store, so a write of any kind
      // would actually land in the keys asserted below.
      await withRealStorage()
      const user = userEvent.setup()
      await renderFeature()

      await user.click(closeBox())
      await user.click(helpToggle() as HTMLElement)
      await user.click(closeBox())
      await settle()

      // Enumerated through the `Storage` interface rather than with
      // `Object.keys`: the jsdom shim in `vitest.setup.ts` is a class holding
      // its map in an own field, so `Object.keys` reports that field and not
      // the stored keys.
      const written = Array.from(
        { length: localStorage.length },
        (_, i) => localStorage.key(i) as string,
      )
      const allowed = ['daily-groove:v2:results', 'daily-groove:v1:prefs']
      expect(written.filter((key) => !allowed.includes(key))).toEqual([])
    })

    // --- Step C8: a broken store still explains the game --------------------

    it('explains the game when storage cannot be read at all (F8 E3 R15, AC14)', async () => {
      await withRealStorage()
      const getItem = vi
        .spyOn(localStorage, 'getItem')
        .mockImplementation(() => {
          throw new Error('storage disabled')
        })

      try {
        await renderFeature()

        // A new browser and a broken one look the same, and the safe direction
        // is to explain the game rather than withhold the explanation.
        expect(box()).toBeInTheDocument()
      } finally {
        getItem.mockRestore()
      }
    })
  })


  // --- feature-10 Epic 1, Steps D2-D7: tapping a root sounds it -------------

  /**
   * The reference voice is *not* mocked, in keeping with the rest of this
   * file: the browser is stubbed instead, so these run over the same fetch,
   * decode and node path a real tap takes. Which files exist is
   * `notes.generated.ts`'s business, so the expected URL is read from it.
   */
  const noteSrc = (root: Root) =>
    (NOTES.find((note) => note.root === root) as { audioSrc: string }).audioSrc

  /** Every URL asked for so far, in order. */
  const fetchedUrls = () =>
    (globalThis.fetch as unknown as Mock).mock.calls.map(([url]) => String(url))

  /** Only the reference notes: the groove's own file is not one of them. */
  const fetchedNotes = () =>
    fetchedUrls().filter((url) => url.startsWith('/notes/'))

  /** Wait for the tap's fetch-decode-start chain to have settled. */
  const soundedNotes = async (count: number) => {
    await waitFor(() => expect(fake.sources).toHaveLength(count))
    return fake.sources
  }

  // Step D2 — R1, R2, AC1. It is also AC3 and AC21: the groove has never been
  // played here, so nothing has been warmed and the note is fetched on demand.
  it('selects the tapped root and sounds its note (D2, R1, R2, R3, AC1)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(within(rootGroup()).getByRole('button', { name: 'E♭' }))

    expect(
      within(rootGroup()).getByRole('button', { name: 'E♭' }),
    ).toHaveAttribute('aria-pressed', 'true')

    const [note] = await soundedNotes(1)
    expect(fetchedNotes()).toEqual([noteSrc('E♭')])
    // One-shot, not a loop, and started rather than scheduled (R3, R4).
    expect(note.loop).toBe(false)
    expect(note.start).toHaveBeenCalledTimes(1)
  })

  // Step D3 — R1, AC2. The handler is deliberately unguarded, so the chip that
  // is already selected still sounds. A guard on "the value changed" would
  // break this and nothing else, which is why the case is written down.
  it('sounds the selected root again when it is tapped again (D3, R1, AC2)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    const chip = () => within(rootGroup()).getByRole('button', { name: 'E♭' })
    await user.click(chip())
    await soundedNotes(1)
    await user.click(chip())
    const nodes = await soundedNotes(2)

    expect(chip()).toHaveAttribute('aria-pressed', 'true')
    expect(nodes[1].start).toHaveBeenCalledTimes(1)
    // Heard twice, fetched once (R17, AC14).
    expect(fetchedNotes()).toEqual([noteSrc('E♭')])
  })

  // Step D5 — R12, AC10. The chips are already disabled on a finished day;
  // this is the guard that the new call did not route around that lock.
  it('stays silent on a day that has been solved (D5, R12, AC10)', async () => {
    const stored: DailyResult = {
      date: TODAY(),
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [SOLVING],
      solved: true,
    }
    mockStore.get.mockResolvedValue(stored)
    mockStore.getAll.mockResolvedValue([stored])

    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(within(rootGroup()).getByRole('button', { name: 'G' }))

    expect(fetchedNotes()).toEqual([])
    expect(fake.sources).toHaveLength(0)
    expect(
      within(rootGroup()).getByRole('button', { name: 'G' }),
    ).toHaveAttribute('aria-pressed', 'false')
  })

  // Step D6 — R7, AC6. Nothing special-cases the twelve: the page hands the
  // whole chromatic set to the voice whatever the mode, and the row is what
  // narrows. Switching modes therefore costs no fetch of its own.
  it('sounds each of simple mode’s six roots (D6, R7, AC6)', async () => {
    await enableSimpleMode()
    const user = userEvent.setup()
    await renderPuzzle(<GroovePuzzle groove={DORIAN} />)

    const six = simpleRoots()
    expect(chipTexts(rootGroup())).toEqual(six)

    for (const root of six) {
      await user.click(within(rootGroup()).getByRole('button', { name: root }))
    }

    await waitFor(() =>
      expect(fetchedNotes()).toEqual(six.map((root) => noteSrc(root))),
    )
    await soundedNotes(six.length)
  })

  // Step D7 — R6, R13, AC5, AC11. The two voices share the context and nothing
  // else. This fails loudly if the transport is ever reused to play a note.
  it('leaves the groove untouched, and the groove leaves the note alone (D7, R6, R13, AC5, AC11)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await play(user)
    await advance(loopFraction(0.5))
    const groove = fake.sources[0]
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50',
    )

    await user.click(within(rootGroup()).getByRole('button', { name: 'A' }))
    const [, note] = await soundedNotes(2)

    // The groove kept playing, from where it was: no stop, no restart, no
    // rewind, and one context between the two voices (R6, R14, AC5).
    expect(groove.stop).not.toHaveBeenCalled()
    expect(screen.getByRole('progressbar')).toHaveAttribute(
      'aria-valuenow',
      '50',
    )
    expect(
      screen.getByRole('button', { name: 'Stop the loop' }),
    ).toBeInTheDocument()
    expect(fake.contexts).toHaveLength(1)

    // And the other direction: stopping the groove does not cut the note, which
    // rings on to its natural end (R13, AC11).
    await user.click(screen.getByRole('button', { name: 'Stop the loop' }))
    expect(groove.stop).toHaveBeenCalledTimes(1)
    expect(note.stop).not.toHaveBeenCalled()
  })

  // Step D4 — R9, R10, AC8. The selection is the half that must not depend on
  // the audio: with no Web Audio at all the chip still takes the tap, and the
  // groove's own banner is not raised on a reference note's account (R11).
  it('selects and stays quiet where Web Audio is unavailable (D4, R9, R10, R11, AC8)', async () => {
    vi.stubGlobal('AudioContext', undefined)
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(within(rootGroup()).getByRole('button', { name: 'F' }))
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(
      within(rootGroup()).getByRole('button', { name: 'F' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByRole('alert')).toBeNull()
    expect(fake.sources).toHaveLength(0)
  })


  // --- feature-10 Epic 1, Step I2: the row is warmed after the groove ------

  /** Every reference note there is, in the order the module lists them. */
  const allNoteSrcs = () => NOTES.map((note) => note.audioSrc)

  // R18, R19, AC21. Warming is an optimisation that must never contend with
  // the groove the player actually pressed, so it waits for that fetch and
  // decode to finish before asking for anything of its own.
  it('warms the whole row once the groove has decoded, never before (I2, R18, R19)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    // Nothing is asked for until the player asks for something.
    expect(fetchedUrls()).toEqual([])

    await play(user)
    await waitFor(() => expect(fetchedNotes()).toHaveLength(NOTES.length))

    // The groove's own file was asked for first; the twelve notes followed it.
    const urls = fetchedUrls()
    expect(urls[0]).toBe(GROOVE.audioSrc)
    expect(urls.indexOf(GROOVE.audioSrc)).toBeLessThan(
      urls.findIndex((url) => url.startsWith('/notes/')),
    )
    // The whole row, whatever the mode: simple mode's six are a subset (R7).
    expect([...fetchedNotes()].sort()).toEqual([...allNoteSrcs()].sort())
    // Warming sounds nothing — the groove is still the only voice (R18).
    expect(fake.sources).toHaveLength(1)
  })

  it('warms once, not on every press (I2, R19)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await play(user)
    await waitFor(() => expect(fetchedNotes()).toHaveLength(NOTES.length))

    await user.click(screen.getByRole('button', { name: 'Stop the loop' }))
    await play(user)
    await settle()

    // Still twelve: the second press warms nothing, and neither does the
    // decoded buffer already in hand (R17, AC14).
    expect(fetchedNotes()).toHaveLength(NOTES.length)
  })

  // R19a, AC21. Warming is never a precondition. A player who taps a root
  // before ever pressing play hears it, fetched on demand.
  it('sounds a tap that lands before any warm (I2, R19a, AC21)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await user.click(within(rootGroup()).getByRole('button', { name: 'B' }))

    const [note] = await soundedNotes(1)
    expect(note.start).toHaveBeenCalledTimes(1)
    // Exactly the one note it needed — the row was never warmed (R19a).
    expect(fetchedNotes()).toEqual([noteSrc('B')])
  })


  // --- feature-10 Epic 2, Steps C3-C5: the card says it --------------------

  // Step C3 — R1a, R5, AC6. The glyph marks where; this sentence is what
  // actually names the behaviour.
  it('reads the new caption under the play control (E2 R1a, R5, AC6)', async () => {
    await renderPuzzle()

    expect(screen.getByText(CAPTION)).toBeInTheDocument()
    // ...and the wording it replaced is gone (F10 E2 R1a).
    expect(
      screen.queryByText('Play along. Find the note that feels like home.'),
    ).toBeNull()
  })

  // Step C4 — R1a, AC6a. R1a supersedes the wording half of feature-4 E2 R4
  // and nothing else: the caption still follows the control, full width, in a
  // column. Written so a later edit cannot move it while chasing its wording.
  it('keeps the caption below the control at full width (E2 R1a, AC6a)', async () => {
    await renderPuzzle()

    const play = screen.getByRole('button', { name: 'Play the loop' })
    const caption = screen.getByText(CAPTION)

    // Same stack, control first.
    expect(play.nextElementSibling).toBe(caption)
    expect(caption.parentElement).toBe(play.parentElement)
    expect(play.parentElement).toHaveClass('flex-col')
    expect(play.parentElement).not.toHaveClass('flex-row')
    // Still the muted, small caption feature-4 put there — tone and size are
    // that epic's, not this one's.
    expect(caption.className).toMatch(/text-text-muted/)
    expect(caption.className).toMatch(/text-\[13px\]/)
  })

  // Step C5 — R10, AC11. No "seen it" flag, no fade after first use: the
  // glyph is the same on a reload as it was on the first frame.
  it('remembers nothing about the glyph across a reload (E2 R10, AC11)', async () => {
    const user = userEvent.setup()
    const first = await renderFeature()

    const marked = () =>
      within(rootGroup())
        .getAllByRole('button')
        .map((chip) => chipAdornment(chip))

    expect(marked().every((glyph) => glyph === NOTE_GLYPH)).toBe(true)

    await user.click(within(rootGroup()).getAllByRole('button')[0])
    await settle()

    // A reload: the tree goes away and the page is built again from storage.
    first.unmount()
    await renderFeature()

    const after = marked()
    expect(after).toHaveLength(12)
    expect(after.every((glyph) => glyph === NOTE_GLYPH)).toBe(true)

    // ...and the tap left no key behind that could have recorded it. Read
    // through the `Storage` interface — see the how-to-play test above.
    const written = Array.from(
      { length: localStorage.length },
      (_, i) => localStorage.key(i) as string,
    )
    const allowed = ['daily-groove:v2:results', 'daily-groove:v1:prefs']
    expect(written.filter((key) => !allowed.includes(key))).toEqual([])
  })

  // --- feature-11 Epic 3: the chords over the playing bars -----------------

  /**
   * The day's changes, bar by bar, worked out the way the card works them out.
   * `GROOVE.progression` is three chords, so bar four is a return to the first
   * — which is what the generator comps, and what the row has to print.
   */
  const BAR_CHORDS = barChords(GROOVE.progression)

  /** The symbols written over the track, in bar order, or null if there is no row. */
  const trackChords = () => {
    const row = screen.queryByTestId('chord-row')
    return row === null
      ? null
      : Array.from(row.querySelectorAll('[data-bar]')).map((cell) => cell.textContent)
  }

  it('prints no chord over the bars while the day is still on (E3 R2, AC2)', async () => {
    const user = userEvent.setup()
    const { container } = await renderPuzzle()

    // A fresh day: nothing over the track.
    expect(trackChords()).toBeNull()

    // Two attempts spent, neither correct — still nothing.
    await guess(user, 'C', wrongFlavour())
    await guess(user, 'G', wrongFlavour())
    expect(trackChords()).toBeNull()

    // ...and playing the groove does not print them either. This is the guard
    // that matters most: the progression names the root and the mode outright,
    // so a row here would answer both halves of the puzzle before the solve.
    await play(user)
    await advance(loopFraction(0.6))
    expect(trackChords()).toBeNull()
    for (const chord of BAR_CHORDS) {
      expect(screen.queryAllByText(chord), chord).toEqual([])
    }
    expect(container.textContent).not.toContain(GROOVE.progression)
  })

  it('writes the four symbols over the bars once the day is solved (E3 R1, AC1)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'C', wrongFlavour())
    expect(trackChords()).toBeNull()

    await guess(user, 'C', 'Aeolian')

    expect(trackChords()).toEqual(BAR_CHORDS)
    // Over the track, not somewhere else on the page.
    expect(screen.getByTestId('chord-row').nextElementSibling).toBe(
      screen.getByRole('progressbar'),
    )
  })

  it('names the answer beside the tempo only once the day is over', async () => {
    const user = userEvent.setup()
    const { container } = await renderPuzzle()

    // The meta line is the tempo and the day, and nothing that answers the
    // puzzle — not before a guess, and not after a wrong one.
    expect(container.textContent).not.toContain('C Aeolian')
    await guess(user, 'C', wrongFlavour())
    expect(container.textContent).not.toContain('C Aeolian')

    await guess(user, 'C', 'Aeolian')

    // One line under the groove's name, tempo first. Since F12 E3 the answer
    // joins the *end* of that line rather than the middle of it: the card is
    // handed a finished meta line ("<bpm> bpm · <day>", or "· shared groove")
    // and cannot take it apart to insert anything — which is exactly what stops
    // it deciding the line again. Same subject, same rendered node.
    expect(
      screen.getByText(
        // Strict again: the answer sits between the tempo and the day, exactly
        // where feature-11 put it. `metaLine` composes the whole line, so the
        // shared page's wording needed no room made for it here (F12 E3).
        new RegExp(`^${GROOVE.bpm} bpm · C Aeolian · `),
      ),
    ).toBeInTheDocument()
  })

  it('writes them for a day given up on too (E3 R3, AC3)', async () => {
    const wrong = wrongFlavour()
    const stored: DailyResult = {
      date: TODAY(),
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [
        miss('C', wrong, true),
        miss('G', wrong, false),
        miss('G', otherWrongFlavour(), false),
      ],
      solved: false,
      revealed: true,
    }
    mockStore.get.mockResolvedValue(stored)
    mockStore.getAll.mockResolvedValue([stored])

    await renderPuzzle()

    expect(trackChords()).toEqual(BAR_CHORDS)
  })

  it('reads the same over the track as it does on the lead sheet (E3 R1)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'C', 'Aeolian')

    const sheet = within(solutionPanel()).getByRole('img', { name: CHANGES_READ })
    const sheetBars = Array.from(sheet.querySelectorAll('[data-bar]')).map(
      (bar) => bar.textContent,
    )

    // One mapping, two drawings: the row over the bars and the sheet below
    // cannot disagree about which chord bar four is.
    expect(trackChords()).toEqual(sheetBars)
    expect(trackChords()).toEqual(CHANGES_READ.split(' · '))
  })

  // --- Feature 12, Epic 1: the session that records nothing -----------------

  /**
   * A shared groove is practice. It plays the whole puzzle and writes nothing —
   * the page hands the session a `ResultStore` whose write path is gone, so
   * there is no save site left to reach (F12 E1 R18, R20, R21, R22).
   *
   * Nothing about how the page *reads* changes, and nothing about how it *looks*
   * changes here: the shared framing, the way back to today and the date line
   * are all Epic 3's. This block is the persistence switch and only that.
   */
  describe('a shared groove (F12 E1)', () => {
    /** The shared page, rendered and settled exactly as the daily one is. */
    const renderShared = () =>
      renderPuzzle(<GroovePuzzle groove={GROOVE} mode="shared" />)

    /** A solved day, N days back — the streak's raw material. */
    const solved = (daysAgo: number): DailyResult => ({
      date: isoDate(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)),
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [SOLVING],
      solved: true,
      grooveId: 'groove-02',
    })

    it('writes nothing when it is played through to a solve (R18, AC9)', async () => {
      const user = userEvent.setup()
      await renderShared()

      await guess(user, 'C', wrongFlavour())
      await guess(user, 'C', 'Aeolian')

      // The day was played: the panel is on screen and the control says so.
      expect(
        screen.getByRole('heading', { name: 'C Aeolian' }),
      ).toBeInTheDocument()
      expect(control()).toHaveAccessibleName('Solved')
      // ...and nothing was recorded, under today's date or any other.
      expect(mockStore.save).not.toHaveBeenCalled()
    })

    it('writes nothing when it is given up on either (R18, AC9)', async () => {
      const user = userEvent.setup()
      await renderShared()
      const wrong = wrongFlavour()

      await guess(user, 'C', wrong)
      await guess(user, 'G', wrong)
      await guess(user, 'G', otherWrongFlavour())
      await user.click(giveUp() as HTMLElement)
      await user.click(giveUp() as HTMLElement)

      expect(solutionPanel()).toBeInTheDocument()
      expect(mockStore.save).not.toHaveBeenCalled()
    })

    it('still shows the streak the saved records imply (R19, AC9)', async () => {
      const records = [solved(1), solved(2), solved(3)]
      mockStore.get.mockResolvedValue(null)
      mockStore.getAll.mockResolvedValue(records)

      const user = userEvent.setup()
      await renderShared()

      // Read, not written: a shared page shows the player's real run.
      expect(screen.getByLabelText(/current streak/i)).toHaveTextContent(
        '3 days streak',
      )
      expect(mockStore.getAll).toHaveBeenCalled()

      await guess(user, 'C', wrongFlavour())

      // A miss on a shared groove does not break the run — the unsolved day it
      // would have written is never written.
      expect(screen.getByLabelText(/current streak/i)).toHaveTextContent(
        '3 days streak',
      )
      expect(mockStore.save).not.toHaveBeenCalled()
    })

    /**
     * The case that actually regressed while this epic was built, so it is
     * asserted where it was visible: on the page (R19, AC9).
     *
     * `useProgress` merges the day into the record set the streak derives from
     * *before* it writes, so that a store which throws never costs the player
     * their guess. A store that keeps nothing by design is not a store that
     * failed — and until `ResultStore.persists` told the two apart, solving a
     * shared groove made the pill and the payoff panel both read one higher
     * than the player's real run, until a reload took it back.
     *
     * A miss is asserted above. A solve is the harder half: it is the only
     * ending that would move a streak forward.
     */
    it('leaves the streak where it was across a shared solve (R19, AC9)', async () => {
      const user = userEvent.setup()
      // Yesterday and the day before, both solved: a live run of 2, which a
      // solve dated today would carry to 3 if it were recorded.
      mockStore.getAll.mockResolvedValue([solved(1), solved(2)])
      await renderShared()

      const before = screen.getByLabelText(/current streak/i).textContent
      expect(before).toMatch(/2 days streak/)

      await guess(user, 'C', 'Aeolian')

      // The day ended, and ended solved...
      expect(control()).toHaveAccessibleName('Solved')
      // ...and the number is byte-identical to what it was before the play.
      expect(screen.getByLabelText(/current streak/i).textContent).toBe(before)
      // Including in the payoff panel, which names the streak in its own words
      // and was the surface the inflated number showed up on.
      expect(solutionPanel()?.textContent ?? '').not.toMatch(/3 days/)
      expect(mockStore.save).not.toHaveBeenCalled()
    })

    it('plays like the daily puzzle in every other respect (R22)', async () => {
      const user = userEvent.setup()
      await renderShared()
      const wrong = wrongFlavour()

      // The same two rows, the same twelve roots and four modes.
      expect(within(rootGroup()).getAllByRole('button').map(chipLabel)).toEqual(
        ROOTS,
      )
      expect(
        within(flavourGroup())
          .getAllByRole('button')
          .map((b) => b.textContent),
      ).toEqual(flavours())

      // The same check control: prompting, then naming the pair, then locked.
      expect(control()).toHaveAccessibleName('Pick a root and a mode')
      expect(control()).toBeDisabled()
      await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
      await user.click(
        within(flavourGroup()).getByRole('button', { name: wrong }),
      )
      expect(control()).toHaveAccessibleName(`Check C ${wrong}`)
      expect(control()).toBeEnabled()

      // The same dots and the same feedback.
      expect(dotStates()).toEqual(['unspent', 'unspent', 'unspent'])
      await user.click(control())
      expect(dotStates()).toEqual(['spent', 'unspent', 'unspent'])
      expect(screen.getByText(/right home note/i)).toBeInTheDocument()

      // The same nudge on the second miss, at the same threshold.
      expect(nudge()).not.toBeInTheDocument()
      await guess(user, 'G', wrong)
      expect((nudge() as HTMLElement).textContent).toMatch(/root is C\./)

      // The same way out, offered from the third miss.
      expect(giveUp()).toBeNull()
      await guess(user, 'G', otherWrongFlavour())
      expect(giveUp()).toHaveAccessibleName('Give up and show the answer')

      // The same simple-mode toggle, narrowing both rows.
      await user.click(screen.getByRole('switch', { name: /simple mode/i }))
      expect(
        within(rootGroup()).getAllByRole('button').map(chipLabel),
      ).toEqual(simpleRootOptions(new Date(), answerOf(GROOVE)))
      expect(
        within(flavourGroup())
          .getAllByRole('button')
          .map((b) => b.textContent),
      ).toEqual(['Major', 'Minor'])
    })

    it('opens clean on the next visit (R21, AC11)', async () => {
      const user = userEvent.setup()
      const first = await renderShared()

      await guess(user, 'C', wrongFlavour())
      await guess(user, 'G', wrongFlavour())
      expect(dotStates()).toEqual(['spent', 'spent', 'unspent'])
      first.unmount()

      // Reload. Nothing was stored, so there is nothing to restore.
      await renderShared()

      expect(dotStates()).toEqual(['unspent', 'unspent', 'unspent'])
      expect(control()).toHaveAccessibleName('Pick a root and a mode')
      expect(control()).toBeDisabled()
      expect(
        within(rootGroup())
          .getAllByRole('button')
          .filter((b) => b.getAttribute('aria-pressed') === 'true'),
      ).toHaveLength(0)
      expect(nudge()).not.toBeInTheDocument()
    })

    it('leaves the day at / unplayed and its storage untouched (R18, R20)', async () => {
      // NOTE: `GROOVE` is a fixture, never the groove the rotation actually
      // serves today, so this is the general "a shared play writes nothing"
      // claim through real storage rather than R20's today's-groove case. A
      // shared link to today's own groove no longer reaches this page at all —
      // the route redirects it to `/`, asserted in
      // `src/app/groove/[uuid]/SharedGroove.test.tsx`.
      // Through the real localStorage-backed store, so "nothing was written" is
      // a claim about the actual key rather than about a spy.
      const { createLocalStore: realStore } = await vi.importActual<
        typeof import('../lib/persistence/storage')
      >('../lib/persistence/storage')
      const real = realStore()
      mockStore.get.mockImplementation((date: string) => real.get(date))
      mockStore.getAll.mockImplementation(() => real.getAll())
      mockStore.save.mockImplementation((result: DailyResult) =>
        real.save(result),
      )

      try {
        const user = userEvent.setup()

        // GROOVE stands for today's groove, opened by its own share link.
        const shared = await renderShared()
        await guess(user, 'C', wrongFlavour())
        await guess(user, 'C', 'Aeolian')
        expect(
          screen.getByRole('heading', { name: 'C Aeolian' }),
        ).toBeInTheDocument()
        shared.unmount()

        // Nothing reached storage at all.
        expect(localStorage.getItem('daily-groove:v2:results')).toBeNull()

        // ...and today's puzzle is still waiting at `/`, unplayed.
        await renderPuzzle()
        expect(dotStates()).toEqual(['unspent', 'unspent', 'unspent'])
        expect(
          screen.queryByRole('heading', { name: 'C Aeolian' }),
        ).not.toBeInTheDocument()
        expect(screen.getByLabelText(/current streak/i)).toHaveTextContent(
          /no streak yet/i,
        )

        // The daily puzzle still records, which is the difference under test.
        await guess(user, 'C', 'Aeolian')
        expect(await real.get(TODAY())).not.toBeNull()
      } finally {
        localStorage.removeItem('daily-groove:v2:results')
      }
    })

    it('records the day when the mode is daily, given or defaulted (R23)', async () => {
      const user = userEvent.setup()

      const explicit = await renderPuzzle(
        <GroovePuzzle groove={GROOVE} mode="daily" />,
      )
      await guess(user, 'C', wrongFlavour())
      expect(mockStore.save).toHaveBeenCalledTimes(1)
      explicit.unmount()

      mockStore.save.mockClear()

      // The default is the daily mode, so every existing caller is unchanged.
      await renderPuzzle()
      await guess(user, 'C', wrongFlavour())
      expect(mockStore.save).toHaveBeenCalledTimes(1)
      expect(mockStore.save.mock.calls[0][0].date).toBe(TODAY())
    })
  })

  // --- F12 Epic 2, Step C5: the share control on the page ------------------

  describe('sharing the groove (F12 E2)', () => {
    const shareControl = () => screen.getByRole('button', { name: 'Share' })

    /** The link this fixture lives at, from the page's own origin (R3, AC2). */
    const link = () => `${window.location.origin}/groove/${GROOVE.uuid}`

    /**
     * A browser with a Web Share sheet, installed the way the fake
     * `AudioContext` is: the control feature-detects `navigator.share` at press
     * time, so standing one up is what makes the offered URL observable through
     * the composed page rather than through a prop nobody in the app passes.
     */
    function installShareSheet() {
      const share = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'share', {
        configurable: true,
        writable: true,
        value: share,
      })
      return share
    }

    afterEach(() => {
      Reflect.deleteProperty(navigator, 'share')
    })

    it('offers share from the first frame, with nothing played yet (R1, R2, AC1)', async () => {
      await renderPuzzle()

      expect(shareControl()).toBeInTheDocument()
      expect(shareControl()).toHaveAccessibleName('Share')
      // Nothing has been spent: the control is there before the game is played,
      // not as a reward for finishing it.
      expect(dotStates()).toEqual(['unspent', 'unspent', 'unspent'])
    })

    it('still offers it after a solve, under the same label (R2, AC1)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, 'C', wrongFlavour())
      expect(shareControl()).toHaveAccessibleName('Share')

      await guess(user, 'C', 'Aeolian')
      expect(control()).toHaveAccessibleName('Solved')
      expect(shareControl()).toHaveAccessibleName('Share')
    })

    it('still offers it after a reveal, under the same label (R2, AC1)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()
      const wrong = wrongFlavour()

      await guess(user, 'C', wrong)
      await guess(user, 'G', wrong)
      await guess(user, 'G', otherWrongFlavour())
      await user.click(giveUp() as HTMLElement)
      await user.click(giveUp() as HTMLElement)

      expect(solutionPanel()).toBeInTheDocument()
      expect(shareControl()).toHaveAccessibleName('Share')
    })

    it("offers this groove's own link, and nothing else in it (R3, R7, AC2, AC3)", async () => {
      const share = installShareSheet()
      const user = userEvent.setup()
      await renderPuzzle()

      // With the day spent and the answer on screen, the link is still only a
      // uuid: there is nothing in it to spoil.
      await guess(user, 'C', 'Aeolian')
      await user.click(shareControl())
      await waitFor(() => expect(share).toHaveBeenCalledTimes(1))

      expect(share).toHaveBeenCalledWith({ url: link() })
      const offered = (share.mock.calls[0][0] as { url: string }).url
      for (const secret of [
        'Aeolian',
        GROOVE.scale,
        GROOVE.chord,
        GROOVE.progression,
        GROOVE.name,
        GROOVE.id,
      ]) {
        expect(offered).not.toContain(secret)
      }
    })

    it('leaves playback and the day alone when it is pressed (R5, AC8)', async () => {
      const share = installShareSheet()
      const user = userEvent.setup()
      await renderPuzzle()

      // The two things a stray press could disturb: a sounding groove and a
      // chosen root.
      await play(user)
      await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
      await advance(loopFraction(0.25))

      await user.click(shareControl())
      await waitFor(() => expect(share).toHaveBeenCalledTimes(1))

      // Still playing, and still playing the same pass.
      expect(
        screen.getByRole('button', { name: 'Stop the loop' }),
      ).toBeInTheDocument()
      await advance(loopFraction(0.25))
      expect(
        screen.getByRole('button', { name: 'Stop the loop' }),
      ).toBeInTheDocument()

      // No attempt was spent, the selection survived, and nothing was recorded.
      expect(dotStates()).toEqual(['unspent', 'unspent', 'unspent'])
      expect(
        within(rootGroup()).getByRole('button', { name: 'C' }),
      ).toHaveAttribute('aria-pressed', 'true')
      expect(control()).toHaveAccessibleName('Pick a root and a mode')
      expect(mockStore.save).not.toHaveBeenCalled()
      expect(screen.queryByRole('alert')).toBeNull()
    })

    it('offers the same control on a shared groove (R4, AC10)', async () => {
      const share = installShareSheet()
      const user = userEvent.setup()
      await renderPuzzle(<GroovePuzzle groove={GROOVE} mode="shared" />)

      expect(shareControl()).toHaveAccessibleName('Share')

      // A groove that arrived by link can be passed on, and passing it on
      // offers that same groove.
      await user.click(shareControl())
      await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
      expect(share).toHaveBeenCalledWith({ url: link() })
    })
  })

  // --- F12 Epic 3, Track A: the framing on a shared page -------------------

  /**
   * Steps A4 and A5. Epic 1 made `/groove/<uuid>` play the same puzzle with
   * `mode="shared"`; this is what that mode is allowed to change about the
   * page. Exactly two things: a notice above the card, and the words "shared
   * groove" where the date stands. Everything else — the header, the streak
   * pill, the how-to-play box, both cards and every control on them — is the
   * daily page, unchanged, and most of the assertions below are about that.
   */
  describe('the framing on a shared groove (F12 E3)', () => {
    const renderShared = (groove: Groove = GROOVE) =>
      renderPuzzle(<GroovePuzzle groove={groove} mode="shared" />)

    /** The notice above the card, found by its own opening words. */
    const notice = () => screen.queryByText(/this is a shared groove/i)

    /** The way back, which is the notice's own link. */
    const wayBack = () => screen.getByRole('link', { name: /back to today/i })

    /**
     * The groove card's meta line: the one paragraph on the page that opens
     * with a tempo. Located by what it says rather than by a test id, because
     * what it says is the whole subject of R1a.
     */
    const cardMeta = () =>
      screen.getByText(
        (_content, element) =>
          element?.tagName === 'P' &&
          /^\d+ bpm/.test(element.textContent ?? ''),
      )

    /** A solved day, N days back — the streak's raw material. */
    const solvedDaysAgo = (daysAgo: number): DailyResult => ({
      date: isoDate(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)),
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [SOLVING],
      solved: true,
      grooveId: 'groove-02',
    })

    /** The how-to-play box, by its own heading, and the header's question mark. */
    const helpBox = () =>
      screen.queryByRole('heading', { level: 2, name: 'How to play' })
    const helpToggle = () => screen.queryByRole('button', { name: 'How to play' })

    /** The streak pill's whole line, as the header renders it. */
    const streakLine = () =>
      screen.getByLabelText(/current streak/i).textContent

    // --- Step A4: it says what it is, before anything is pressed ------------

    it('says this is a shared groove rather than today’s puzzle, before any press (R1, R3, AC1)', async () => {
      await renderShared()

      const framing = notice() as HTMLElement
      expect(framing).toBeInTheDocument()
      expect(framing.textContent ?? '').toMatch(
        /not today's puzzle|not today’s puzzle/i,
      )
      // Nothing has been played: the framing is on the first painted frame, not
      // a consolation shown after a solve.
      expect(dotStates()).toEqual(['unspent', 'unspent', 'unspent'])
      expect(control()).toHaveAccessibleName('Pick a root and a mode')
    })

    it('says playing it leaves the streak and the day alone (R2, AC2)', async () => {
      const user = userEvent.setup()
      mockStore.getAll.mockResolvedValue([solvedDaysAgo(1), solvedDaysAgo(2)])
      await renderShared()

      expect((notice() as HTMLElement).textContent ?? '').toMatch(/streak/i)
      expect((notice() as HTMLElement).textContent ?? '').toMatch(/day/i)

      // And the page keeps that promise: a miss moves neither the pill nor the
      // record behind it.
      const before = streakLine()
      await guess(user, 'G', wrongFlavour())
      expect(streakLine()).toBe(before)
      expect(mockStore.save).not.toHaveBeenCalled()
    })

    it('sits above the groove card, where the how-to-play box sits (R3, AC1)', async () => {
      const { container } = await renderShared()

      // Source order is the reading order: the notice precedes the game it
      // frames, and never covers it.
      const framing = notice() as HTMLElement
      const name = screen.getByRole('heading', { name: GROOVE.name })
      expect(
        framing.compareDocumentPosition(name) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      // ...and inside the feature's own region, not bolted above it.
      expect(
        container.querySelector(`section[aria-label="${APP_NAME}"]`),
      ).toContainElement(framing)
    })

    it('reads "shared groove" where the date stands, and shows no date (R1a, R4, AC11)', async () => {
      await renderShared()

      expect(cardMeta().textContent).toBe(`${GROOVE.bpm} bpm · shared groove`)
      expect(cardMeta().textContent).not.toContain(dateLine(new Date()))
    })

    it('leaves the daily card’s line exactly as it was (R1a, R4, AC11)', async () => {
      await renderPuzzle()

      expect(cardMeta().textContent).toBe(
        `${GROOVE.bpm} bpm · ${dateLine(new Date())}`,
      )
      expect(notice()).toBeNull()
    })

    it('points every link that leaves the page at today, and offers one while in play (R5, R7, AC5)', async () => {
      const user = userEvent.setup()
      await renderShared()

      // Anchors only: the share control is an action, not navigation, and it
      // renders no link at all — it can only ever print a URL as plain text.
      const links = () => screen.queryAllByRole('link')
      expect(links()).toHaveLength(1)
      expect(links()[0]).toHaveAttribute('href', '/')
      expect(wayBack()).toBe(links()[0])

      // Still one, and still `/`, once the game is under way.
      await play(user)
      await guess(user, 'G', wrongFlavour())
      expect(links()).toHaveLength(1)
      expect(links()[0]).toHaveAttribute('href', '/')
    })

    it('adds the only link the daily page never had (R5, AC5)', async () => {
      await renderPuzzle()

      // The daily page carries no link out at all, which is what makes the
      // one on the shared page identifiable as the way back.
      expect(screen.queryAllByRole('link')).toEqual([])
    })

    it('renders the header with the player’s real streak, as on / (R7a, AC12)', async () => {
      mockStore.getAll.mockResolvedValue([
        solvedDaysAgo(1),
        solvedDaysAgo(2),
        solvedDaysAgo(3),
      ])

      const shared = await renderShared()
      expect(streakLine()).toMatch(/3 days streak/)
      const sharedHeader = streakLine()
      shared.unmount()

      // The same value, written the same way, as the daily page writes it.
      await renderPuzzle()
      expect(streakLine()).toBe(sharedHeader)
    })

    it('follows the same new-or-lapsed rule for how to play in both modes (R7b, AC13)', async () => {
      const user = userEvent.setup()

      // Nothing saved: a shared link is the likeliest first contact anyone has
      // with the app, and it explains itself.
      const first = await renderShared()
      expect(helpBox()).toBeInTheDocument()
      first.unmount()

      // A returning player: no box on either page, and the question mark still
      // brings it back on both.
      mockStore.getAll.mockResolvedValue([solvedDaysAgo(1)])

      const returning = await renderShared()
      expect(helpBox()).toBeNull()
      await user.click(helpToggle() as HTMLElement)
      expect(helpBox()).toBeInTheDocument()
      returning.unmount()

      const daily = await renderPuzzle()
      expect(helpBox()).toBeNull()
      await user.click(helpToggle() as HTMLElement)
      expect(helpBox()).toBeInTheDocument()
      daily.unmount()

      // ...and a lapsed player gets it on a shared link too.
      mockStore.getAll.mockResolvedValue([solvedDaysAgo(40)])
      await renderShared()
      expect(helpBox()).toBeInTheDocument()
    })

    it('has the same puzzle region and the same controls in both modes (R4, AC3)', async () => {
      /** Everything the puzzle region is made of, as the page renders it. */
      const shape = () => ({
        cards: screen
          .getAllByRole('heading', { level: 2 })
          .map((h) => h.textContent),
        roots: within(rootGroup()).getAllByRole('button').map(chipLabel),
        modes: within(flavourGroup())
          .getAllByRole('button')
          .map((b) => b.textContent),
        check: control().textContent,
        checkName: control().getAttribute('aria-label'),
        play: screen.getByRole('button', { name: 'Play the loop' }).textContent,
        transports: screen.getAllByRole('progressbar').length,
        dots: dotStates(),
        caption: screen.getByText(CAPTION).textContent,
        simple: screen.getByRole('switch', { name: /simple mode/i }).getAttribute(
          'aria-checked',
        ),
      })

      const daily = await renderPuzzle()
      const dailyShape = shape()
      daily.unmount()

      await renderShared()
      expect(shape()).toEqual(dailyShape)
    })

    it('leaves the day at / exactly as it was behind the way back (R6, AC4)', async () => {
      const wrong = wrongFlavour()
      const today: DailyResult = {
        date: TODAY(),
        answer: { root: 'C', flavour: 'Aeolian' },
        attempts: [miss('C', wrong, true), miss('G', wrong, false)],
        solved: false,
      }
      mockStore.get.mockResolvedValue(today)
      mockStore.getAll.mockResolvedValue([
        today,
        solvedDaysAgo(1),
        solvedDaysAgo(2),
      ])

      // The day as it stands before the shared link is opened.
      const before = await renderPuzzle()
      const dayBefore = { dots: dotStates(), streak: streakLine() }
      expect(dayBefore.dots).toEqual(['spent', 'spent', 'unspent'])
      before.unmount()

      // A whole shared groove, played out.
      const user = userEvent.setup()
      const shared = await renderShared()
      expect(wayBack()).toHaveAttribute('href', '/')
      await guess(user, 'C', 'Aeolian')
      expect(mockStore.save).not.toHaveBeenCalled()
      shared.unmount()

      // Following the way back: the same two spent attempts, the same streak.
      await renderPuzzle()
      expect({ dots: dotStates(), streak: streakLine() }).toEqual(dayBefore)
    })

    // --- Step A5: today's own groove, shared, is still shared ---------------

    /**
     * The feature has no special case for today's own groove, and this is what
     * proves its absence — still, after the addendum that redirects a shared
     * link to today's groove away to `/`.
     *
     * That redirect is the *route's*: `src/app/groove/[uuid]/SharedGroove.tsx`
     * decides where to send the player, because the daily pick is the viewer's
     * calendar day and only the browser knows it. Handed today's groove and told
     * it is shared, the puzzle still frames it as shared and still records
     * nothing — which is exactly the property that lets the decision live in one
     * place instead of two. See that route's own test for the redirect.
     */
    it('frames today’s own groove as shared, and still records nothing (R13, R14)', async () => {
      const todays = selectGrooveForDate(new Date(), GROOVES)
      const answer = answerOf(todays)
      const user = userEvent.setup()

      await renderPuzzle(<GroovePuzzle groove={todays} mode="shared" />)

      await user.click(
        within(rootGroup()).getByRole('button', { name: answer.root }),
      )
      await user.click(
        within(flavourGroup()).getByRole('button', { name: answer.flavour }),
      )
      await user.click(control())

      // Played through to a solve...
      expect(
        screen.getByRole('heading', {
          name: `${answer.root} ${answer.flavour}`,
        }),
      ).toBeInTheDocument()
      // ...and still a shared groove in every visible respect.
      expect(notice()).toBeInTheDocument()
      expect(cardMeta().textContent).toBe(
        `${todays.bpm} bpm · ${answer.root} ${answer.flavour} · shared groove`,
      )
      expect(wayBack()).toHaveAttribute('href', '/')
      expect(mockStore.save).not.toHaveBeenCalled()
    })

    // --- Step A6: a finished shared groove points at today's ---------------

    /** The invitation, by the link that is its whole point. */
    const invitation = () =>
      screen.queryByRole('link', { name: /play today/i })
    /** The line it sits in, which is what "worded the same way" is about. */
    const invitationLine = () => invitation()?.closest('p')?.textContent ?? null

    it('shows no invitation while the shared groove is still in play (R5a, AC15)', async () => {
      const user = userEvent.setup()
      await renderShared()

      expect(invitation()).toBeNull()
      await play(user)
      await guess(user, 'G', wrongFlavour())
      await guess(user, 'D', wrongFlavour())

      // Two misses in: still only the way back that was always there.
      expect(invitation()).toBeNull()
      expect(screen.getAllByRole('link')).toHaveLength(1)
      expect(wayBack()).toHaveAttribute('href', '/')
    })

    it('invites the player to today once the shared groove is solved (R5a, AC5, AC14)', async () => {
      const user = userEvent.setup()
      await renderShared()

      await guess(user, 'C', 'Aeolian')

      const invite = invitation() as HTMLElement
      expect(invite).toBeInTheDocument()
      expect(invite).toHaveAttribute('href', '/')

      // Below the answer, not folded into it: the panel is the day's payoff and
      // knows nothing about shared grooves.
      const panel = solutionPanel()
      expect(
        panel.compareDocumentPosition(invite) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(panel).not.toContainElement(invite)

      // Two links now, and both still point at `/` — there is no third
      // destination anywhere on the page.
      const links = screen.getAllByRole('link')
      expect(links).toHaveLength(2)
      for (const link of links) expect(link).toHaveAttribute('href', '/')
    })

    it('shows the same invitation, worded the same way, when it is given up on (R5b, AC14)', async () => {
      const user = userEvent.setup()
      const wrong = wrongFlavour()

      // Ending one: solved.
      const solvedRun = await renderShared()
      await guess(user, 'C', 'Aeolian')
      const whenSolved = invitationLine()
      expect(whenSolved).not.toBeNull()
      solvedRun.unmount()

      // Ending two: given up on.
      await renderShared()
      await guess(user, 'C', wrong)
      await guess(user, 'G', wrong)
      await guess(user, 'G', otherWrongFlavour())
      await user.click(giveUp() as HTMLElement)
      await user.click(giveUp() as HTMLElement)

      expect(solutionPanel()).toBeInTheDocument()
      expect(invitation()).toHaveAttribute('href', '/')
      expect(invitationLine()).toBe(whenSolved)
    })

    it('keeps the invitation for the rest of the session (R5b)', async () => {
      const user = userEvent.setup()
      await renderShared()

      await guess(user, 'C', 'Aeolian')
      expect(invitation()).toBeInTheDocument()

      // Nothing a played-out page still offers takes it away again.
      await play(user)
      await user.click(screen.getByRole('switch', { name: /simple mode/i }))
      expect(invitation()).toBeInTheDocument()
    })

    it('never appears on the daily page, in either ending (R5c, AC16)', async () => {
      const user = userEvent.setup()
      const wrong = wrongFlavour()

      const solvedRun = await renderPuzzle()
      await guess(user, 'C', 'Aeolian')
      expect(solutionPanel()).toBeInTheDocument()
      expect(invitation()).toBeNull()
      expect(screen.queryAllByRole('link')).toEqual([])
      solvedRun.unmount()

      mockStore.get.mockResolvedValue(null)

      await renderPuzzle()
      await guess(user, 'C', wrong)
      await guess(user, 'G', wrong)
      await guess(user, 'G', otherWrongFlavour())
      await user.click(giveUp() as HTMLElement)
      await user.click(giveUp() as HTMLElement)

      expect(solutionPanel()).toBeInTheDocument()
      expect(invitation()).toBeNull()
      expect(screen.queryAllByRole('link')).toEqual([])
    })
  })
})
