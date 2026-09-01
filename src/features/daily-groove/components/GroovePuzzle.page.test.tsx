/**
 * The composed page — and the map to the other four files.
 *
 * Feature-14 Epic 2 split one 119-case `GroovePuzzle.test.tsx` into five. All
 * five render the whole feature through `GroovePuzzle`; they are not tests of
 * a region component in isolation, which is what the region folders'
 * own `GrooveHeader.test.tsx`, `GuessCard.test.tsx` and the rest are for. The
 * `GroovePuzzle.` prefix is what tells the two kinds apart at a glance.
 *
 * **The rule.** A case goes in the file for the screen region it exercises. A
 * case about the composition rather than about a region goes here.
 *
 * | File | The region, and the one-line test for it |
 * | :-- | :-- |
 * | `GroovePuzzle.header.test.tsx`   | `components/header/` — the streak pill, the help toggle, the share control. Does it read or press something in the top bar? |
 * | `GroovePuzzle.intro.test.tsx`    | `components/intro/` — the how-to-play box. Does it open, close or read that box? |
 * | `GroovePuzzle.guessing.test.tsx` | `components/puzzle/`, the guessing half — chips, dots, feedback, the nudge, the way out, simple mode. Does it make or judge a guess? Reaching the solved panel counts: the case is about the guess that got there. |
 * | `GroovePuzzle.sounding.test.tsx` | `components/puzzle/`, the sounding half — the groove card and its meta line, the transport, the progress track, the reference-note voice, the chord row. Does something make a sound, or move with one? |
 * | `components/solved/` | the payoff box itself — the answer, the character line, the lead sheet, the staff — has no `GroovePuzzle.` file. Its cases are `SolvedPanel.test.tsx`'s, and a case that spans the box *and* another region belongs here. |
 * | `GroovePuzzle.page.test.tsx`     | this file — hydration, storage, layout, the landmark, which groove the page picked, and what the page as a whole does or refuses to render. Does the assertion span regions, or hold no region at all? |
 *
 * **The regions are four, not three.** Feature-15 moved `SolvedPanel`,
 * `LeadSheet` and `ScaleStaff` out of `components/puzzle/` into
 * `components/solved/`, so the payoff box is its own region with its own
 * colocated tests. The map above was written before that move and used to file
 * the solved panel under `puzzle/`.
 *
 * **`puzzle/` is two files, not one, and that is deliberate.** Nine of the
 * feature's seventeen region components live under `components/puzzle/`,
 * against four in `header/`, three in `solved/` and one in `intro/`. Grouping
 * strictly by region therefore puts 65 of the 119 cases in a single file — more
 * than half, over
 * this epic's ceiling of 40, and still the one file every feature would have to
 * touch, which is the problem the split exists to solve. So `puzzle/` divides
 * along a seam that was already visible in the cases: the *guessing surface*
 * against the *sounding page*.
 *
 * **Adding case 120.** Name the region it exercises and put it there. If it
 * exercises two regions at once, or none — a layout rule, a landmark, what
 * storage held before the first frame, what the page must never render — it
 * belongs in this file. If it is a `puzzle/` case, ask whether it is about
 * making a guess or about making a sound. No file may pass 40 cases (AC1); if
 * one is about to, that is a signal the grouping needs revisiting, not a case
 * to file somewhere else.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DailyResult, Groove } from '../types'
// The shared setup — fixtures, the fake audio context, the render and the
// accessible-name queries — has one home (F14 E2 R5). Everything below the
// `vi.mock` block is imported from it rather than restated here.
import {
  CAPTION,
  chipLabel,
  control,
  dotStates,
  flavourGroup,
  flavours,
  GROOVE,
  guess,
  installPuzzleAudio,
  miss,
  nudge,
  otherWrongFlavour,
  play,
  renderPuzzle,
  resetMockStore,
  rootGroup,
  settle,
  SOLVING,
  teardownPuzzleAudio,
  TODAY,
  wrongFlavour,
} from '../testing/puzzleHarness'

// The audio module is NOT mocked, and neither is scoring: the flows below run
// through the real Web Audio player, the real store and the real
// `scoreAttempt`. Playback is driven by stubbing the browser instead — see
// `installPuzzleAudio` in the harness.

// Mock the persistence seam so useProgress reads/writes a controllable store —
// no real localStorage. useProgress defaults to this module-singleton store.
// `vi.hoisted` and `vi.mock` are lifted to the top of the file that calls them,
// so neither survives being wrapped in a helper: only the store factory is
// shared, and this block stays here.
const { mockStore } = await vi.hoisted(async () => {
  const { createMockStore } = await import('../testing/puzzleHarness')
  return { mockStore: createMockStore() }
})
// Only the module singleton is stood in for: `createReadOnlyStore` stays the
// real decorator, because the shared session below is the real one.
vi.mock('../lib/persistence/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/persistence/storage')>()),
  createLocalStore: () => mockStore,
}))

import { GroovePuzzle } from './GroovePuzzle'
import { isoDate, selectGrooveForDate } from '../lib/puzzle/selectGroove'
import { GROOVES } from '../data/grooves.generated'
import { renderFeature } from '../testing/renderFeature'
import { APP_NAME } from '@/lib/branding'

describe('GroovePuzzle', () => {
  beforeEach(() => {
    resetMockStore(mockStore)
    installPuzzleAudio()
  })

  afterEach(() => {
    teardownPuzzleAudio()
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

  /**
   * The two-column row's children, exactly as the existing R15 cases find them.
   * There are two, before and after feature-15 Epic 5 — what changes is what
   * the second one holds, never how many there are.
   */
  function columnsOf(container: HTMLElement) {
    const split = container.querySelector('.md\\:flex-row') as HTMLElement
    const columns = Array.from(split.children) as HTMLElement[]
    expect(columns).toHaveLength(2)
    return columns
  }

  /**
   * The ended layout: the box is the row's second column beside the groove
   * card, and the guess card is a later sibling of the row (F15 E5 R1, R1a, R3,
   * R7, AC1, AC1a, AC4, AC7, AC7a).
   *
   * Only the cases that assert the *new* placement call this. The two guard
   * cases below have to pass before the move as well as after it, so they use
   * `columnsOf` and never this.
   */
  function expectEndedLayout(container: HTMLElement) {
    const split = container.querySelector('.md\\:flex-row') as HTMLElement
    const columns = columnsOf(container)

    const box = solutionPanel()
    const grooveName = screen.getByRole('heading', { name: GROOVE.name })
    const question = screen.getByRole('heading', {
      level: 3,
      name: 'What is it?',
    })

    // R1, AC1: the row's two children are the groove card and the box, and the
    // guess card is out of the row entirely.
    expect(columns[0]).toContainElement(grooveName)
    expect(columns[1]).toContainElement(box)
    expect(split).not.toContainElement(question)

    // AC1a: the box is the second column and the row aligns both columns'
    // edges, which is what puts its first line level with the play control
    // above `md` — and what gives the two boxes the same height. Flexbox
    // stretches by default, so the claim is that no `items-*` override turns
    // that off. A structural assertion, not a measurement: jsdom has no
    // viewport, and `md:flex-row` is pinned by the existing 'stacks its
    // columns' case.
    expect(split.className).not.toMatch(/(^|\s)items-/)
    // Each column is a one-cell grid, so the card inside fills the height the
    // column was stretched to rather than sitting content-height inside it.
    for (const column of columns) {
      expect(column).toHaveClass('grid')
    }
    // AC1c's inner half, and it has to name the right element. `box` is the
    // `role="status"` div, so its PARENT is the wrapper the column stretches;
    // asserting on the grandparent checks the column instead, which carries
    // `grid` for its own reasons and passes whatever the wrapper does. Both the
    // wrapper and the status div must be grids, or the panel keeps its content
    // height inside a stretched column and comes up short of the groove card —
    // which is what happened, and what no assertion caught until someone
    // looked at the rendered page.
    expect(box.parentElement, 'the box has no wrapper to stretch').toHaveClass(
      'grid',
    )
    expect(box).toHaveClass('grid')

    // AC7a: each of the row's two children is one column, and the guess card
    // below keeps that same width rather than spreading to the page. It is a
    // later sibling of the row, and it is itself a row of the same shape — same
    // gap, same collapse point, its card in an identically classed column — so
    // the two rows cannot disagree about how wide a column is.
    for (const column of columns) {
      expect(column).toHaveClass('w-full')
      expect(column).toHaveClass('md:w-auto')
    }
    const stack = split.parentElement as HTMLElement
    expect(stack.className).toContain('flex-col')
    const siblings = Array.from(stack.children)
    const guessRoot = siblings.find((el) => el.contains(question)) as HTMLElement
    expect(guessRoot, 'the guess card is not a sibling of the row').toBeDefined()
    expect(siblings.indexOf(guessRoot)).toBeGreaterThan(siblings.indexOf(split))

    // The gap is what sets a column's width once `flex-1` has split the
    // remainder, so the same gap class on both rows is the whole claim. A
    // hand-written `w-[calc(50%-…)]` would pass the class checks above and
    // still be fourteen pixels wide of the column it is copying.
    const gap = Array.from(split.classList).find((c) => c.startsWith('gap-'))
    expect(gap, 'the row declares no gap').toBeDefined()
    expect(guessRoot).toHaveClass(gap!)

    // The collapse point is *read off the real row* rather than restated as
    // `md`, because two breakpoints that can drift apart would be the defect:
    // if the row above ever collapsed at `sm` and the card below at `md`, there
    // would be a band of widths where the card is half a page wide with nothing
    // beside it. One source, both rows.
    const collapse = Array.from(split.classList).find((c) =>
      c.endsWith(':flex-row'),
    )
    expect(collapse, 'the row declares no collapse point').toBeDefined()
    const breakpoint = collapse!.split(':')[0]
    expect(guessRoot).toHaveClass(collapse!)

    const guessColumn = Array.from(guessRoot.children).find((el) =>
      el.contains(question),
    ) as HTMLElement
    expect(guessColumn).toHaveClass('w-full')
    expect(guessColumn).toHaveClass(`${breakpoint}:w-auto`)
    expect(guessColumn).toHaveClass('flex-1')
    // The empty column beside it is what makes `flex-1` halve rather than fill,
    // and it carries nothing to announce.
    const spacer = Array.from(guessRoot.children).find(
      (el) => el !== guessColumn,
    ) as HTMLElement
    expect(spacer, 'nothing holds the second half open').toBeDefined()
    expect(spacer).toHaveAttribute('aria-hidden', 'true')
    expect(spacer).toBeEmptyDOMElement()
    // `flex-1` is the whole mechanism: without it the spacer takes no share of
    // the row and the finished card spreads to the full width, which is the one
    // thing AC7a exists to prevent. Asserted because deleting it changes no
    // other assertion in this file.
    expect(spacer).toHaveClass('flex-1')
    // And it must not become a flex item on a phone, or it would add a phantom
    // gap under the card where the row has collapsed to one column.
    expect(spacer).toHaveClass('hidden')
    // And it is `display: none` below that same collapse point, which is what
    // leaves the phone exactly as the user says it already looks: the card full
    // width, and no phantom gap beneath it, because an element that is not
    // displayed is not a flex item and takes no `gap`.
    expect(spacer).toHaveClass('hidden')
    expect(spacer).toHaveClass(`${breakpoint}:block`)

    // R7: document order is the visual order, at every width — groove card,
    // box, guess card.
    expect(
      grooveName.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      box.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    // AC7, the horizontal half of R6: a flex child that cannot be forced wider
    // than its column, and a staff that scales down rather than overflowing.
    expect(columns[1]).toHaveClass('min-w-0')
    expect(box.querySelector('svg')).toHaveClass('max-w-full')
  }

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
    // The box's one line of prose is the lesson now, not the score: the tries
    // sentence this used to read left with F15 E1 R5.
    expect(screen.getByText(/the plain minor scale/i)).toBeInTheDocument()
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

  // Feature-15 Epic 1, Step D5 — R6, R8, AC9, AC11. The score left the payoff
  // box; this is the guard that it did not leave the page with it. Asserted
  // here rather than in a region file because it spans three: the box, the
  // guessing card's dot row and the header's streak pill.
  it('keeps one status region, and the score outside it (F15 E1 R6, R8, AC9, AC11)', async () => {
    const day = (daysAgo: number): DailyResult => ({
      date: isoDate(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)),
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [SOLVING],
      solved: true,
    })
    const today = day(0)
    mockStore.get.mockResolvedValue(today)
    mockStore.getAll.mockResolvedValue([today, day(1), day(2)])

    await renderPuzzle()
    const panel = solutionPanel()

    // R8 — the payoff is announced once. The panel is the live region; the line
    // inside it got no live region of its own.
    expect(panel).toHaveAttribute('role', 'status')
    expect(panel.querySelectorAll('[role="status"]')).toHaveLength(0)

    // R6, AC11 — the day's outcome and the run are still legible on the page:
    // the dot row reads Solved, the streak pill shows the run. Neither number
    // is in the box.
    expect(panel.textContent).not.toMatch(/streak/i)
    expect(screen.getByRole('img', { name: 'Solved' })).toBeInTheDocument()
    expect(screen.getByLabelText(/current streak/i)).toHaveTextContent(
      '3 days streak',
    )
  })

  /**
   * Feature-15 Epic 3, Step D4 — R6, AC1, AC6. The numerals belong to the box,
   * and the box only exists once the day is over — so half the answer cannot
   * reach the screen while the day is still being guessed. Asserted here rather
   * than in `SolvedPanel.test.tsx` because the subject spans two regions: the
   * box that draws them and the whole page that must not.
   */
  it('writes the day\'s numerals in the box and nowhere else (F15 E3 R6, AC1)', async () => {
    const user = userEvent.setup()
    // `GROOVE` predates the field, so the degrees are added here rather than in
    // the shared fixture: a page that shows numerals needs a groove that has
    // them, and every other case in the five files is about a groove without.
    const withDegrees: Groove = { ...GROOVE, progressionDegrees: [0, 3, 4] }
    await renderPuzzle(<GroovePuzzle groove={withDegrees} />)

    // Mid-puzzle the changes are not on the page, so neither are their degrees.
    expect(document.querySelectorAll('[data-numeral]')).toHaveLength(0)

    await guess(user, 'C', 'Aeolian')

    const panel = solutionPanel()
    const numerals = Array.from(
      document.querySelectorAll<HTMLElement>('[data-numeral]'),
    )
    expect(numerals).toHaveLength(4)
    for (const numeral of numerals) expect(panel).toContainElement(numeral)
    // Bar four of a three-chord figure is a return, in the numeral as in the
    // symbol above it.
    expect(numerals.map((numeral) => numeral.textContent)).toEqual([
      'I',
      'IV',
      'V',
      'I',
    ])
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

  /**
   * Feature-15 Epic 5, Step A1. The epic's most important case, because AC1b is
   * the criterion a plausible-looking diff can silently break: a `key` on the
   * first column, or a conditional wrapper above the groove card, reaches the
   * right document order and remounts the transport that is sounding.
   *
   * One case rather than three because it is one transition — and because the
   * file's case budget is real.
   */
  it('keeps the groove card sounding, announces the box once, and moves nothing under the finger (F15 E5 R1b, R4, R5, R5a, AC1b, AC5, AC6, AC9)', async () => {
    const scrolled = vi.fn()
    // jsdom does not implement scrollIntoView at all, so it is assigned and
    // restored rather than spied on — vi.spyOn on a missing method throws.
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scrolled
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    try {
      const user = userEvent.setup()
      const { container } = await renderPuzzle()

      // The baseline: one live region on a playable day — the feedback line
      // under the check control, a `role="status"` since feature-3. AC5's
      // "exactly one" is about the box, which is why the count is stated rather
      // than assumed.
      expect(document.querySelectorAll('[role="status"]')).toHaveLength(1)

      // The loop is sounding before the day ends, which is the state R1b is
      // about.
      await play(user)
      const grooveName = screen.getByRole('heading', { name: GROOVE.name })
      const transportButton = screen.getByRole('button', {
        name: 'Stop the loop',
      })
      const track = within(columnsOf(container)[0]).getByRole('progressbar')

      await guess(user, 'C', 'Aeolian')

      // AC1b: the same nodes, so nothing in the groove card was unmounted and
      // the transport was not interrupted. The audio graph itself is owned by
      // `useTransport` above the row and could not be re-created by a change
      // inside it; these three identities are what "the same node" asks for.
      expect(screen.getByRole('heading', { name: GROOVE.name })).toBe(grooveName)
      expect(screen.getByRole('button', { name: 'Stop the loop' })).toBe(
        transportButton,
      )
      expect(within(columnsOf(container)[0]).getByRole('progressbar')).toBe(
        track,
      )

      // AC5: two regions now, exactly one of them the box, none nested in it,
      // and nothing turned into a dialog or an alert.
      const regions = Array.from(document.querySelectorAll('[role="status"]'))
      expect(regions).toHaveLength(2)
      expect(regions.filter((region) => region === solutionPanel())).toHaveLength(
        1,
      )
      expect(solutionPanel().querySelectorAll('[role="status"]')).toHaveLength(0)
      expect(solutionPanel()).not.toHaveAttribute('aria-modal')
      expect(screen.queryAllByRole('dialog')).toEqual([])
      expect(screen.queryAllByRole('alert')).toEqual([])

      // AC6: the day's own ending settles the check control — feature-11 E4's
      // behaviour, not this epic's — and the move focuses nothing else. Stated
      // in the negative on purpose: the guess card is re-parented (R3a), so
      // jsdom drops focus to `document.body`, and asserting that node would
      // make the remount a requirement instead of a cost.
      expect(control()).toBeDisabled()
      expect(solutionPanel()).not.toContainElement(
        document.activeElement as HTMLElement | null,
      )
      expect(document.activeElement).not.toBe(transportButton)

      // AC9, R5a, R5b: no jump, no pointer, no toast. The announcement and the
      // reorder are the whole change.
      expect(scrolled).not.toHaveBeenCalled()
      expect(scrollTo).not.toHaveBeenCalled()
    } finally {
      Element.prototype.scrollIntoView = original
      scrollTo.mockRestore()
    }
  })

  /**
   * Feature-15 Epic 5, Step A2. Both elements that move in this epic are walked
   * upward to the feature's region, because a positioning class anywhere on
   * either chain would mean the placement was achieved with CSS rather than with
   * markup.
   */
  it('achieves the placement in the markup, not with positioning or order (F15 E5 R7, AC8)', async () => {
    // Anchored at the *start* of a class on purpose: a bare /order-/ matches
    // `border-r-[3px]`, which the lead sheet really renders. `order-` then has
    // to take its own suffix — `order-first`, `md:order-2` — or the pattern
    // would only ever match a class that ends at the hyphen, which is to say
    // never.
    const FORBIDDEN =
      /(?:^|\s)(?:[a-z]+:)?(?:order-\S+|absolute|fixed|sticky)(?:\s|$)/

    const user = userEvent.setup()
    const { container } = await renderPuzzle()
    await guess(user, 'C', 'Aeolian')

    const section = container.querySelector(
      `section[aria-label="${APP_NAME}"]`,
    ) as HTMLElement
    const chain: Element[] = [...columnsOf(container)]
    for (const start of [
      solutionPanel() as Element,
      screen.getByRole('heading', { level: 3, name: 'What is it?' }) as Element,
    ]) {
      for (
        let el: Element | null = start;
        el && el !== section;
        el = el.parentElement
      ) {
        chain.push(el)
      }
    }
    for (const el of chain) {
      expect(el.className, el.className).not.toMatch(FORBIDDEN)
    }
  })

  /**
   * Feature-15 Epic 5, Step A3. The move itself: the box takes the guess card's
   * column and the finished guess card drops below the row, with everything it
   * had inside the row.
   */
  it('puts the box beside the groove card and the finished guess card below the row (F15 E5 R1, R1a, R3, AC1, AC1a, AC4, AC7, AC7a)', async () => {
    const user = userEvent.setup()
    const { container } = await renderPuzzle()

    await guess(user, 'C', 'Aeolian')

    expectEndedLayout(container)

    const guessRoot = screen
      .getByRole('heading', { level: 3, name: 'What is it?' })
      .closest('div') as HTMLElement
    // R3, AC4: not hidden, not collapsed, not summarised, not stripped.
    expect(guessRoot).toContainElement(rootGroup())
    expect(guessRoot).toContainElement(flavourGroup())
    expect(guessRoot).toContainElement(
      screen.getByRole('switch', { name: /simple mode/i }),
    )
    expect(guessRoot).toContainElement(control())
    expect(within(flavourGroup()).getAllByRole('button')).toHaveLength(
      flavours().length,
    )
    expect(dotStates()).toHaveLength(3)
    // R5b: nothing was added to point at the box — no marker, no pointer, no
    // toast. The feedback line is the card's one live region and predates this.
    expect(guessRoot.querySelectorAll('[aria-live]')).toHaveLength(1)
  })

  /**
   * Feature-15 Epic 5, Step A4. One condition, two endings: a day given up on
   * is a day ended, and there is no second branch anywhere in the composer.
   */
  it('places the box the same way on a day given up on (F15 E5 R8, AC2)', async () => {
    const revealedDay: DailyResult = {
      date: TODAY(),
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [
        miss('D', wrongFlavour(), false),
        miss('E', otherWrongFlavour(), false),
        miss('F', wrongFlavour(), false),
      ],
      solved: false,
      revealed: true,
    }
    mockStore.get.mockResolvedValue(revealedDay)
    mockStore.getAll.mockResolvedValue([revealedDay])

    const { container } = await renderPuzzle()

    expectEndedLayout(container)
  })

  it("falls back to today's groove when no prop is given", async () => {
    await renderPuzzle(<GroovePuzzle />)
    expect(screen.getByRole('button', { name: /^play the loop$/i })).toBeInTheDocument()
    expect(rootGroup()).toBeInTheDocument()
  })

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
      const user = userEvent.setup();
      const { container } = await renderFeature();

      const groove = selectGrooveForDate(new Date(), GROOVES);

      /** A chip in a row whose label is not the day's answer — a certain miss. */
      const wrongChips = (group: HTMLElement, answer: string) =>
        within(group)
          .getAllByRole('button')
          .filter((chip) => chipLabel(chip) !== answer);

      // Feature-15 Epic 5, Step A5 — AC3 is about a *part-played* day, which is
      // the state a reorder could plausibly get wrong, so two guesses are spent
      // before the layout is read.
      for (const spend of [0, 1]) {
        await user.click(wrongChips(rootGroup(), groove.root)[spend]);
        await user.click(wrongChips(flavourGroup(), groove.flavour)[spend]);
        await user.click(control());
      }
      expect(dotStates().filter((state) => state !== 'unspent')).toHaveLength(2);

      expect(container.textContent).not.toContain(groove.chord);
      expect(container.textContent).not.toContain(groove.progression);

      const columns = columnsOf(container as HTMLElement);
      // Two guesses spent, no terminal state: no box to place, so the row is
      // the groove card and the guess card, in the order they are today.
      expect(columns[1]).toContainElement(
        screen.getByRole('heading', { level: 3, name: 'What is it?' }),
      );
      expect(columns[0].querySelector('[role="status"]')).toBeNull();
      // The page's one live region — the feedback line — is in column two,
      // where the guess card still is.
      expect(document.querySelectorAll('[role="status"]')).toHaveLength(1);
      expect(
        screen
          .getByRole('heading', { name: groove.name })
          .compareDocumentPosition(
            screen.getByRole('heading', { level: 3, name: 'What is it?' }),
          ) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
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

    /** A solved day, N days back — the streak's raw material. */
    const solvedDaysAgo = (daysAgo: number): DailyResult => ({
      date: isoDate(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)),
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [SOLVING],
      solved: true,
      grooveId: 'groove-02',
    })

    /** The streak pill's whole line, as the header renders it. */
    const streakLine = () =>
      screen.getByLabelText(/current streak/i).textContent

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

    /**
     * Feature-13 narrowed these two from "no anchors" to "no anchors that
     * navigate the app".
     *
     * The rule was always about navigation: the shared page offers exactly one
     * way onward and it is the way back to today, and the daily page offers
     * none — which is what makes that one identifiable. Counting every anchor
     * was a proxy for that, and it stopped being a safe one when the how-to-play
     * box gained the drum samples' licence credit, which points off-site.
     *
     * So the assertion now says the thing it means, and says it more strictly
     * than before: every in-app link is enumerated *and* every remaining anchor
     * must leave the site entirely. An internal link cannot hide behind the
     * carve-out, because there is no carve-out — there are two exhaustive sets.
     */
    const inAppLinks = () =>
      screen.queryAllByRole('link').filter((link) => link.getAttribute('href')?.startsWith('/'))

    const offSiteLinks = () =>
      screen.queryAllByRole('link').filter((link) => !link.getAttribute('href')?.startsWith('/'))

    const everyOffSiteLinkReallyLeaves = () => {
      for (const link of offSiteLinks()) {
        expect(link.getAttribute('href')).toMatch(/^https:\/\//)
        expect(link).toHaveAttribute('target', '_blank')
        expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
      }
    }

    it('points every link that leaves the page at today, and offers one while in play (R5, R7, AC5)', async () => {
      const user = userEvent.setup()
      await renderShared()

      // Anchors only: the share control is an action, not navigation, and it
      // renders no link at all — it can only ever print a URL as plain text.
      expect(inAppLinks()).toHaveLength(1)
      expect(inAppLinks()[0]).toHaveAttribute('href', '/')
      expect(wayBack()).toBe(inAppLinks()[0])
      everyOffSiteLinkReallyLeaves()

      // Still one, and still `/`, once the game is under way.
      await play(user)
      await guess(user, 'G', wrongFlavour())
      expect(inAppLinks()).toHaveLength(1)
      expect(inAppLinks()[0]).toHaveAttribute('href', '/')
      everyOffSiteLinkReallyLeaves()
    })

    it('adds the only link the daily page never had (R5, AC5)', async () => {
      await renderPuzzle()

      // The daily page offers no way onward at all, which is what makes the
      // one on the shared page identifiable as the way back.
      expect(inAppLinks()).toEqual([])
      everyOffSiteLinkReallyLeaves()
    })

    /**
     * Feature-15 Epic 5, Step A6. The shared entry point places the box the
     * same way — it renders the same components and Sam meets the same problem
     * here — and the way onward travels with the box rather than being left
     * below the finished guess card.
     */
    it('places the box the same way on a shared groove, with the way onward beneath it (F15 E5 R1, AC1)', async () => {
      const user = userEvent.setup()
      const { container } = await renderShared()

      await guess(user, 'C', 'Aeolian')

      expectEndedLayout(container)

      const invite = screen.getByRole('link', { name: /play today.s groove/i })
      const box = solutionPanel()
      const columns = columnsOf(container)

      // Feature-12 E3's own relationship, restated at the new position: after
      // the box, never folded into it (F12 E3 R5a, AC14).
      expect(
        box.compareDocumentPosition(invite) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(box).not.toContainElement(invite)
      // And it travelled with the box rather than being left below the guess
      // card, so the next move is still beside the answer it belongs to.
      expect(columns[1]).toContainElement(invite)
      // Still the only two in-app destinations, and still both `/`.
      expect(inAppLinks()).toHaveLength(2)
      for (const link of inAppLinks()) expect(link).toHaveAttribute('href', '/')
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
  })
})
