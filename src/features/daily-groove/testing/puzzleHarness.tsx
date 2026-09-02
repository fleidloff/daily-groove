/**
 * The shared setup behind every test that renders the *composed* puzzle page.
 *
 * `GroovePuzzle.test.tsx` grew a 223-line preamble — fixtures, a fake audio
 * context, accessible-name queries and one `beforeEach` — and feature-14 Epic 2
 * splits that file into five — one per screen region, `puzzle/` taking two
 * because 12 of the feature's 17 region components live there, plus one for the
 * composition itself. This module is the one home that setup gets, so the five
 * files share it rather than each carrying a copy (F14 E2 R5, AC6). The grouping
 * rule, and where a new case goes, is at the top of
 * `../components/GroovePuzzle.page.test.tsx`.
 *
 * **What this module cannot hold.** `vi.hoisted` and `vi.mock` are lifted to the
 * top of the file that *calls* them and do not survive being wrapped in a
 * helper — `renderFeature.tsx`'s docstring already records this. So only the
 * store *factory* lives here; every file still opens with its own copy of this
 * block, verbatim:
 *
 * ```ts
 * const { mockStore } = await vi.hoisted(async () => {
 *   const { createMockStore } = await import('../testing/puzzleHarness')
 *   return { mockStore: createMockStore() }
 * })
 * vi.mock('../lib/persistence/storage', async (importOriginal) => ({
 *   ...(await importOriginal<typeof import('../lib/persistence/storage')>()),
 *   createLocalStore: () => mockStore,
 * }))
 * ```
 *
 * The `await import` is not decoration. `vi.hoisted` is lifted *above* the
 * file's import statements, so a plain `createMockStore()` there reads a
 * binding that is still in its temporal dead zone — Vitest reports
 * `Cannot access '__vi_import_N__' before initialization`. Vitest's documented
 * escape is to import inside the hoisted callback. The consequence is that this
 * module is evaluated *before* the caller's `vi.mock` is registered, which is
 * why `renderPuzzle` imports `GroovePuzzle` lazily rather than at the top of
 * this file — see the note there.
 *
 * Only the module singleton is stood in for: `createReadOnlyStore` stays the
 * real decorator, because the shared-groove session is the real one.
 *
 * The audio module is NOT mocked, and neither is scoring: the flows run through
 * the real Web Audio player, the real store and the real `scoreAttempt`.
 * Playback is driven by stubbing the browser instead — see
 * `installPuzzleAudio`.
 */
import type { ReactElement } from 'react'
import { vi, type Mock } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import type { Attempt, Groove, Root } from '../types'
import { flavourOptions } from '../lib/theory/music'
import { isoDate } from '../lib/puzzle/selectGroove'
import {
  installFakeAudioContext,
  type FakeContext,
} from './fakeAudioContext'

export const GROOVE: Groove = {
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
export const CHANGES_READ = 'Cm · Fm · G7 · Cm'

/** The day's four flavour chips, resolved exactly as the component resolves them. */
export const flavours = () => flavourOptions(new Date(), GROOVE)
/** A flavour that is on offer today but is not the answer. */
export const wrongFlavour = () => flavours().find((f) => f !== 'Aeolian') as string
/** A second wrong flavour, so a third guess can differ from the second. */
export const otherWrongFlavour = () =>
  flavours().filter((f) => f !== 'Aeolian' && f !== wrongFlavour())[0]

export const TODAY = () => isoDate(new Date())

export function miss(root: Root, flavour: string, rootMatched: boolean): Attempt {
  return { root, flavour, correct: false, rootMatched, flavourMatched: false }
}

export const SOLVING: Attempt = {
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
export const GROOVE_LOOP_SECONDS = (4 * 4 * 60) / 90

/**
 * The persistence double. Each test *file* still writes its own
 * `vi.hoisted` / `vi.mock` pair — only this factory is shared.
 */
export type MockStore = {
  get: Mock
  getAll: Mock
  save: Mock
}

export function createMockStore(): MockStore {
  return {
    get: vi.fn(),
    getAll: vi.fn(),
    save: vi.fn(),
  }
}

/** Default persistence: empty store, save resolves. */
export function resetMockStore(store: MockStore): void {
  store.get.mockReset().mockResolvedValue(null)
  store.getAll.mockReset().mockResolvedValue([])
  store.save.mockReset().mockResolvedValue(undefined)
}

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

/**
 * Stub the browser's audio clock and animation frames for one test.
 *
 * Returns the fake context and the frame pump so a case that drives the clock
 * itself still can. A buffer a little longer than the music, as the real files
 * are: the mp3 carries encoder delay at its head and padding at its tail.
 */
export function installPuzzleAudio(): { fake: FakeContext; frame: () => void } {
  frame = installFrames()
  fake = installFakeAudioContext({ bufferSeconds: GROOVE_LOOP_SECONDS + 0.1 })
  return { fake, frame }
}

export function teardownPuzzleAudio(): void {
  vi.unstubAllGlobals()
}

/** Seconds into a loop of `GROOVE`, as a fraction of it. */
export const loopFraction = (fraction: number) => GROOVE_LOOP_SECONDS * fraction

/** Move the audio clock, then let the page repaint from where it now reads. */
export async function advance(seconds: number) {
  fake.advance(seconds)
  await act(async () => {
    frame()
  })
}

/** Press the control, and wait for the groove to be sounding. */
export async function play(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Play the loop' }))
  await screen.findByRole('button', { name: 'Stop the loop' })
}

/**
 * Flush the store reads and the hydration effect they gate. The puzzle waits on
 * a promise-returning `ResultStore` before it paints a game, so every test that
 * wants the board has to let that settle first.
 */
export async function settle() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

export async function renderPuzzle(ui?: ReactElement) {
  // `GroovePuzzle` is imported here rather than at the top of this module on
  // purpose. Each test file reaches for `createMockStore` from inside its
  // `vi.hoisted` block, which runs *before* its `vi.mock` of
  // `lib/persistence/storage` is registered — so anything this module pulls in
  // statically is loaded unmocked. `GroovePuzzle` reaches `useProgress`, which
  // calls `createLocalStore()` at module scope, so a static import here would
  // hand every test the real localStorage-backed store.
  const { GroovePuzzle } = await import('../components/GroovePuzzle')
  const result = render(ui ?? <GroovePuzzle groove={GROOVE} />)
  await settle()
  return result
}

/** The note glyph the root row wears (F10 E2 R1). */
export const NOTE_GLYPH = '♪'

/**
 * The caption under the play control, verbatim (F10 E2 R1a, AC6). Feature-4
 * Epic 2 put it below the control; feature-10 Epic 2 gave it this shape, and
 * feature-16 Epic 1 widened its second half to name both rows: the mode chips
 * sound too now, so a sentence that offered only the root row was describing
 * half the instrument (F16 E1 R25).
 */
export const CAPTION =
  'Find the note that feels like home — Play along with your instrument, or tap a root or a mode to hear it.'

/**
 * What that same caption reads while the tap sounds are switched off, verbatim
 * (F16 E2 R12a, AC11a). One line: it names the state and points at the switch
 * two rows above it, and it does not explain what the sounds are for.
 *
 * Two constants rather than one with a hole in it, because the two epics own
 * one half each — feature-16 Epic 1 owns the sounds-on wording above, Epic 2
 * owns this one — and `GroovePuzzle` puts a ternary between them.
 */
export const CAPTION_SOUNDS_OFF =
  'Tap sounds are off — switch them back on under Simple mode.'

/**
 * A chip's label with its decorative adornment left out. The glyph is
 * `aria-hidden`, so this is the chip's accessible name — which is what every
 * assertion about *which* chips a row offers has always been about (F10 E2 R4).
 */
export const chipLabel = (chip: Element) =>
  Array.from(chip.childNodes)
    .filter(
      (node) =>
        !(node instanceof Element && node.getAttribute('aria-hidden') === 'true'),
    )
    .map((node) => node.textContent ?? '')
    .join('')

/** The adornment a chip carries, or `null` when it carries none. */
export const chipAdornment = (chip: Element) =>
  chip.querySelector('[aria-hidden="true"]')?.textContent ?? null

export const rootGroup = () => screen.getByRole('radiogroup', { name: 'Root' })
// The second row holds modes and says so (F7 E4 R1, AC1). The helper is named
// for the domain field behind it — `flavour` on the groove — which the rename
// deliberately left alone.
export const flavourGroup = () => screen.getByRole('radiogroup', { name: 'Mode' })
export const control = () =>
  screen.getByRole('button', { name: /^(Pick a root|Check |Solved$)/ })
export const dotStates = () =>
  Array.from(document.querySelectorAll('[data-dot-state]')).map((el) =>
    el.getAttribute('data-dot-state'),
  )
export const nudge = () => screen.queryByRole('complementary', { name: 'A nudge' })

/** Click a root chip and a flavour chip, then press the check control. */
export async function guess(
  user: ReturnType<typeof userEvent.setup>,
  root: string,
  flavour: string,
) {
  await user.click(within(rootGroup()).getByRole('button', { name: root }))
  await user.click(within(flavourGroup()).getByRole('button', { name: flavour }))
  await user.click(control())
}
