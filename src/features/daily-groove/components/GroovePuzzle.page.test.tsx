import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DailyResult, Groove } from '../types'
import {
  chipLabel,
  control,
  flavourGroup,
  flavours,
  ANSWER,
  GROOVE,
  guess,
  installPuzzleAudio,
  miss,
  nudge,
  nudgeLine,
  verdictLine,
  coachingLine,
  otherWrongFlavour,
  play,
  renderPuzzle,
  resetMockStore,
  seedFullSet,
  rootGroup,
  settle,
  SOLVING,
  teardownPuzzleAudio,
  thirdWrongFlavour,
  TODAY,
  wrongFlavour,
} from '../testing/puzzleHarness'

const { mockStore } = await vi.hoisted(async () => {
  const { createMockStore } = await import('../testing/puzzleHarness')
  return { mockStore: createMockStore() }
})
vi.mock('../lib/persistence/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/persistence/storage')>()),
  createLocalStore: () => mockStore,
}))

import { GroovePuzzle } from './GroovePuzzle'
import { selectGrooveForDate } from '../lib/puzzle/selectGroove'
import { isoDate, nextDayStart } from '@/lib/date'
import { flavourOptions } from '@/lib/theory/music'
import { GROOVES, HEARD_IN } from '../data/grooves.generated'
import { renderFeature } from '../testing/renderFeature'
import { branding, coaching, header, puzzle, routes, solved } from '@/lib/snippets'
const { appName: APP_NAME } = branding

describe('GroovePuzzle', () => {
  beforeEach(async () => {
    resetMockStore(mockStore)
    await seedFullSet()
    installPuzzleAudio()
  })

  afterEach(() => {
    teardownPuzzleAudio()
  })

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
      screen.getByRole('heading', { level: 3, name: puzzle.guessTitle }),
    ]) {
      expect(heading.className, heading.textContent ?? '').toMatch(/font-display/)
      expect(heading.className, heading.textContent ?? '').not.toMatch(/font-jazz/)
    }
  })

  const giveUp = () =>
    screen.queryByRole('button', {
      name: (name) => name === puzzle.giveUp || name === puzzle.giveUpArmed,
    })

  const solutionPanel = () =>
    screen
      .getByRole('heading', { name: 'C Aeolian' })
      .closest('[role="status"]') as HTMLElement

  function columnsOf(container: HTMLElement) {
    const split = container.querySelector('.md\\:flex-row') as HTMLElement
    const columns = Array.from(split.children) as HTMLElement[]
    expect(columns).toHaveLength(2)
    return columns
  }

  function expectEndedLayout(container: HTMLElement) {
    const split = container.querySelector('.md\\:flex-row') as HTMLElement
    const columns = columnsOf(container)

    const box = solutionPanel()
    const grooveName = screen.getByRole('heading', { name: GROOVE.name })
    const question = screen.getByRole('heading', {
      level: 3,
      name: puzzle.guessTitle,
    })

    expect(columns[0]).toContainElement(grooveName)
    expect(columns[1]).toContainElement(box)
    expect(split).not.toContainElement(question)

    expect(split.className).not.toMatch(/(^|\s)items-/)
    for (const column of columns) {
      expect(column).toHaveClass('grid')
    }
    expect(box.parentElement, 'the box has no wrapper to stretch').toHaveClass(
      'grid',
    )
    expect(box).toHaveClass('grid')

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

    const gap = Array.from(split.classList).find((c) => c.startsWith('gap-'))
    expect(gap, 'the row declares no gap').toBeDefined()
    expect(guessRoot).toHaveClass(gap!)

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
    const spacer = Array.from(guessRoot.children).find(
      (el) => el !== guessColumn,
    ) as HTMLElement
    expect(spacer, 'nothing holds the second half open').toBeDefined()
    expect(spacer).toHaveAttribute('aria-hidden', 'true')
    expect(spacer).toBeEmptyDOMElement()
    expect(spacer).toHaveClass('flex-1')
    expect(spacer).toHaveClass('hidden')
    expect(spacer).toHaveClass('hidden')
    expect(spacer).toHaveClass(`${breakpoint}:block`)

    expect(
      grooveName.compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      box.compareDocumentPosition(question) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()

    expect(columns[1]).toHaveClass('min-w-0')
    expect(box.querySelector('svg')).toHaveClass('max-w-full')
  }

  it('waits rather than flashing a fresh game before the day is read (E5 R3, R4, C3a)', async () => {
    mockStore.get.mockReturnValue(new Promise<DailyResult | null>(() => {}))
    mockStore.getAll.mockReturnValue(new Promise<DailyResult[]>(() => {}))

    render(<GroovePuzzle groove={GROOVE} />)

    expect(screen.getByText(puzzle.loading)).toBeInTheDocument()
    expect(
      screen.queryByRole('radiogroup', { name: puzzle.rootGroup }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('heading', { name: 'C Aeolian' }),
    ).not.toBeInTheDocument()
  })

  it('restores the attempts on a reload mid-game (E5 R3, AC1, AC2)', async () => {
    const wrong = wrongFlavour()
    const stored: DailyResult = {
      date: TODAY(),
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [miss('G', wrong, false), miss('D', wrong, false)],
      solved: false,
    }
    mockStore.get.mockResolvedValue(stored)
    mockStore.getAll.mockResolvedValue([stored])

    const user = userEvent.setup()
    await renderPuzzle()

    expect(verdictLine()).toBeNull()
    expect(coachingLine()).toBeInTheDocument()
    expect(nudgeLine()).toBeInTheDocument()

    expect(
      within(rootGroup()).queryByRole('button', { pressed: true }),
    ).toBeNull()
    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
    await user.click(
      within(flavourGroup()).getByRole('button', { name: otherWrongFlavour() }),
    )
    await user.click(control())

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
    expect(
      screen.getByText(solved.modeLine({ flavour: 'Aeolian' }) as string),
    ).toBeInTheDocument()
    expect(control()).toHaveAccessibleName(coaching.checkSolved)
    expect(control()).toBeDisabled()

    await user.click(within(rootGroup()).getByRole('button', { name: 'G' }))
    expect(
      within(rootGroup()).getByRole('button', { name: 'G' }),
    ).toHaveAttribute('aria-pressed', 'false')
    expect(
      within(rootGroup()).getByRole('button', { name: 'C' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

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

    expect(panel).toHaveAttribute('role', 'status')
    expect(panel.querySelectorAll('[role="status"]')).toHaveLength(0)

    expect(panel.textContent).not.toMatch(/streak/i)
    expect(screen.getByLabelText(header.currentStreakName)).toHaveTextContent(
      header.streakDays({ days: 3 }),
    )
  })

  it('writes the day\'s numerals in the box and nowhere else (F15 E3 R6, AC1)', async () => {
    const user = userEvent.setup()
    const withDegrees: Groove = { ...GROOVE, progressionDegrees: [0, 3, 4] }
    await renderPuzzle(<GroovePuzzle groove={withDegrees} />)

    expect(document.querySelectorAll('[data-numeral]')).toHaveLength(0)

    await guess(user, 'C', 'Aeolian')

    const panel = solutionPanel()
    const numerals = Array.from(
      document.querySelectorAll<HTMLElement>('[data-numeral]'),
    )
    expect(numerals).toHaveLength(4)
    for (const numeral of numerals) expect(panel).toContainElement(numeral)
    expect(numerals.map((numeral) => numeral.textContent)).toEqual([
      'I',
      'IV',
      'V',
      'I',
    ])
  })

  it('starts the day fresh when storage holds nothing readable (E5 R5, AC4)', async () => {
    mockStore.get.mockResolvedValue(null)
    mockStore.getAll.mockResolvedValue([])

    await renderPuzzle()

    expect(mockStore.save).not.toHaveBeenCalled()
    expect(control()).toHaveAccessibleName(coaching.pickRootAndMode)
    expect(screen.getByLabelText(header.currentStreakName)).toHaveTextContent(
      header.noStreakYet,
    )
    expect(screen.queryByText(/no grooves behind you yet/i)).toBeNull()
  })

  it('keeps the guess in the session when the write fails (E5 R6, AC5)', async () => {
    mockStore.save.mockRejectedValue(new Error('quota exceeded'))
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'C', wrongFlavour())

    expect(mockStore.save.mock.calls.at(-1)?.[0].attempts).toHaveLength(1)
    expect(screen.getByText(coaching.rootMatched)).toBeInTheDocument()
  })

  it('names its landmark for the app in both branches (F8 E1 R8, AC6)', async () => {
    const { unmount } = render(<GroovePuzzle groove={GROOVE} />)
    expect(screen.getByText(puzzle.loading)).toBeInTheDocument()
    expect(screen.getByRole('region', { name: APP_NAME })).toBeInTheDocument()
    await settle()
    expect(screen.getByRole('region', { name: APP_NAME })).toBeInTheDocument()
    unmount()
  })

  it('reads a pre-rename store back unchanged (F8 E1 R9, AC7)', async () => {
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

    const real = createLocalStore()
    mockStore.get.mockImplementation((date: string) => real.get(date))
    mockStore.getAll.mockImplementation(() => real.getAll())
    mockStore.save.mockImplementation((result: DailyResult) => real.save(result))

    try {
      await renderPuzzle()

      expect(screen.getByLabelText(header.currentStreakName)).toHaveTextContent(
        header.streakDays({ days: 3 }),
      )
      expect(localStorage.getItem('daily-groove:v2:results')).not.toBeNull()
    } finally {
      localStorage.removeItem('daily-groove:v2:results')
    }
  })

  it('stacks its columns by default and only splits higher up (D8, R15, AC12)', async () => {
    const { container } = await renderPuzzle()

    const split = container.querySelector('.md\\:flex-row')
    expect(split, 'no collapsing two-column wrapper found').not.toBeNull()
    expect(split).toHaveClass('flex-col')
    expect(split).not.toHaveClass('flex-row')
  })

  it('gives each column the full width once stacked (R15)', async () => {
    const { container } = await renderPuzzle()

    const split = container.querySelector('.md\\:flex-row') as HTMLElement
    const columns = Array.from(split.children) as HTMLElement[]

    expect(columns).toHaveLength(2)
    for (const column of columns) {
      expect(column).toHaveClass('w-full')
      expect(column).toHaveClass('md:w-auto')
    }
  })

  it('keeps the groove card sounding, announces the box once, and moves nothing under the finger (F15 E5 R1b, R4, R5, R5a, AC1b, AC5, AC6, AC9)', async () => {
    const scrolled = vi.fn()
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = scrolled
    const scrollTo = vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
    try {
      const user = userEvent.setup()
      const { container } = await renderPuzzle()

      expect(document.querySelectorAll('[role="status"]')).toHaveLength(1)

      await play(user)
      const grooveName = screen.getByRole('heading', { name: GROOVE.name })
      const transportButton = screen.getByRole('button', {
        name: puzzle.playName.stop,
      })
      const track = within(columnsOf(container)[0]).getByRole('progressbar')

      await guess(user, 'C', 'Aeolian')

      expect(screen.getByRole('heading', { name: GROOVE.name })).toBe(grooveName)
      expect(screen.getByRole('button', { name: puzzle.playName.stop })).toBe(
        transportButton,
      )
      expect(within(columnsOf(container)[0]).getByRole('progressbar')).toBe(
        track,
      )

      const regions = Array.from(document.querySelectorAll('[role="status"]'))
      expect(regions).toHaveLength(1)
      expect(regions.filter((region) => region === solutionPanel())).toHaveLength(
        1,
      )
      expect(solutionPanel().querySelectorAll('[role="status"]')).toHaveLength(0)
      expect(solutionPanel()).not.toHaveAttribute('aria-modal')
      expect(screen.queryAllByRole('dialog')).toEqual([])
      expect(screen.queryAllByRole('alert')).toEqual([])

      expect(control()).toBeDisabled()
      expect(solutionPanel()).not.toContainElement(
        document.activeElement as HTMLElement | null,
      )
      expect(document.activeElement).not.toBe(transportButton)

      expect(scrolled).not.toHaveBeenCalled()
      expect(scrollTo).not.toHaveBeenCalled()
    } finally {
      Element.prototype.scrollIntoView = original
      scrollTo.mockRestore()
    }
  })

  it('achieves the placement in the markup, not with positioning or order (F15 E5 R7, AC8)', async () => {
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
      screen.getByRole('heading', { level: 3, name: puzzle.guessTitle }) as Element,
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

  it('puts the box beside the groove card and the finished guess card below the row (F15 E5 R1, R1a, R3, AC1, AC1a, AC4, AC7, AC7a)', async () => {
    const user = userEvent.setup()
    const { container } = await renderPuzzle()

    await guess(user, 'C', 'Aeolian')

    expectEndedLayout(container)

    const guessRoot = screen
      .getByRole('heading', { level: 3, name: puzzle.guessTitle })
      .closest('div') as HTMLElement
    expect(guessRoot).toContainElement(rootGroup())
    expect(guessRoot).toContainElement(flavourGroup())
    expect(guessRoot).toContainElement(
      screen.getByRole('switch', { name: puzzle.simpleMode }),
    )
    expect(guessRoot).toContainElement(control())
    expect(within(flavourGroup()).getAllByRole('button')).toHaveLength(
      flavours().length,
    )
    expect(control()).toHaveAccessibleName(coaching.checkSolved)
    expect(guessRoot.querySelectorAll('[aria-live]')).toHaveLength(0)
    expect(nudge()).toBeNull()
  })

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
    expect(
      screen.getByRole('button', { name: puzzle.playName.play }),
    ).toBeInTheDocument()
    expect(rootGroup()).toBeInTheDocument()
  })

  function solvedDay(daysAgo: number): DailyResult {
    return {
      date: isoDate(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)),
      answer: { root: 'G', flavour: 'Dorian' },
      attempts: [SOLVING],
      solved: true,
      grooveId: 'groove-02',
    }
  }

  const fiveSolvedDays = () => [1, 2, 3, 4, 5].map(solvedDay)

  const page = () => screen.getByRole('region', { name: APP_NAME })

  it('renders no played-grooves section, however deep the history (E6 R1, AC1)', async () => {
    mockStore.get.mockResolvedValue(null)
    mockStore.getAll.mockResolvedValue(fiveSolvedDays())

    await renderFeature()

    expect(screen.queryByText(/Grooves you.{0,3}ve played/)).toBeNull()
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
      screen.getAllByRole('button', {
        name: (name) =>
          name === puzzle.playName.play || name === puzzle.playName.stop,
      }),
    ).toHaveLength(1)
  })

  it('shows the same day in the header that it used to pick the groove (R5, AC3)', async () => {
    vi.useFakeTimers()
    try {
      vi.setSystemTime(new Date(2026, 7, 29, 12, 0, 0))
      const today = new Date(2026, 7, 29, 12, 0, 0)
      const expected = selectGrooveForDate(today, GROOVES)

      await renderPuzzle(<GroovePuzzle />)

      expect(screen.getByText(/· Saturday, 29 August$/)).toBeInTheDocument()
      expect(
        screen.getByRole('heading', { name: expected.name }),
      ).toBeInTheDocument()
    } finally {
      vi.useRealTimers()
    }
  })

  describe('through the composed page', () => {
    it("renders the designed shell with a play control and the guessing card", async () => {
      await renderFeature();

      const play = screen.getByRole("button", { name: puzzle.playName.play });
      expect(play).toBeInTheDocument();
      expect(play).toHaveTextContent(`\u25b6 ${puzzle.playText.play}`);
      expect(play).toHaveClass("w-full");

      const roots = screen.getByRole("radiogroup", { name: puzzle.rootGroup });
      const flavours = screen.getByRole("radiogroup", { name: puzzle.modeGroup });
      expect(within(roots).getAllByRole("button")).toHaveLength(12);
      expect(within(flavours).getAllByRole("button")).toHaveLength(4);

      expect(screen.queryAllByRole("checkbox")).toHaveLength(0);
    })

    it("reveals neither the solved panel nor the day's changes before the solve", async () => {
      const user = userEvent.setup();
      const { container } = await renderFeature();

      const groove = selectGrooveForDate(new Date(), GROOVES);

      const wrongChips = (group: HTMLElement, answer: string) =>
        within(group)
          .getAllByRole('button')
          .filter((chip) => chipLabel(chip) !== answer);

      for (const spend of [0, 1]) {
        await user.click(wrongChips(rootGroup(), groove.root)[spend]);
        await user.click(wrongChips(flavourGroup(), groove.flavour)[spend]);
        await user.click(control());
      }
      expect(mockStore.save.mock.calls.at(-1)?.[0].attempts).toHaveLength(2);

      expect(container.textContent).not.toContain(groove.chord);
      expect(container.textContent).not.toContain(groove.progression);

      const columns = columnsOf(container as HTMLElement);
      expect(columns[1]).toContainElement(
        screen.getByRole('heading', { level: 3, name: puzzle.guessTitle }),
      );
      expect(columns[0].querySelector('[role="status"]')).toBeNull();
      expect(document.querySelectorAll('[role="status"]')).toHaveLength(1);
      expect(
        screen
          .getByRole('heading', { name: groove.name })
          .compareDocumentPosition(
            screen.getByRole('heading', { level: 3, name: puzzle.guessTitle }),
          ) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    })

    it("waits for the day's saved record rather than flashing a fresh game", async () => {
      render(<GroovePuzzle />);

      expect(screen.getByText(puzzle.loading)).toBeInTheDocument();
      expect(
        screen.queryByRole("radiogroup", { name: puzzle.rootGroup }),
      ).not.toBeInTheDocument();
    })
  })

  describe('a shared groove (F12 E1)', () => {
    const renderShared = () =>
      renderPuzzle(<GroovePuzzle groove={GROOVE} mode="shared" />)

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

      expect(
        screen.getByRole('heading', { name: 'C Aeolian' }),
      ).toBeInTheDocument()
      expect(control()).toHaveAccessibleName(coaching.checkSolved)
      expect(mockStore.save).not.toHaveBeenCalled()
    })

    it('writes nothing when it is given up on either (R18, AC9)', async () => {
      const user = userEvent.setup()
      await renderShared()
      const wrong = wrongFlavour()

      await guess(user, 'C', wrong)
      await guess(user, 'C', otherWrongFlavour())
      await guess(user, 'C', thirdWrongFlavour())
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

      expect(screen.getByLabelText(header.currentStreakName)).toHaveTextContent(
        header.streakDays({ days: 3 }),
      )
      expect(mockStore.getAll).toHaveBeenCalled()

      await guess(user, 'C', wrongFlavour())

      expect(screen.getByLabelText(header.currentStreakName)).toHaveTextContent(
        header.streakDays({ days: 3 }),
      )
      expect(mockStore.save).not.toHaveBeenCalled()
    })

    it('leaves the streak where it was across a shared solve (R19, AC9)', async () => {
      const user = userEvent.setup()
      mockStore.getAll.mockResolvedValue([solved(1), solved(2)])
      await renderShared()

      const before = screen.getByLabelText(header.currentStreakName).textContent
      expect(before).toMatch(header.streakDays({ days: 2 }))

      await guess(user, 'C', 'Aeolian')

      expect(control()).toHaveAccessibleName(coaching.checkSolved)
      expect(screen.getByLabelText(header.currentStreakName).textContent).toBe(
        before,
      )
      expect(solutionPanel()?.textContent ?? '').not.toMatch(/3 days/)
      expect(mockStore.save).not.toHaveBeenCalled()
    })

    it('opens clean on the next visit (R21, AC11)', async () => {
      const user = userEvent.setup()
      const first = await renderShared()

      await guess(user, 'C', wrongFlavour())
      await guess(user, 'C', otherWrongFlavour())
      const midCoaching = coachingLine()?.textContent ?? null
      expect(midCoaching).not.toBeNull()
      first.unmount()

      await renderShared()

      expect(coachingLine()?.textContent ?? null).not.toBe(midCoaching)
      expect(control()).toHaveAccessibleName(coaching.pickRootAndMode)
      expect(control()).toBeDisabled()
      expect(
        within(rootGroup())
          .getAllByRole('button')
          .filter((b) => b.getAttribute('aria-pressed') === 'true'),
      ).toHaveLength(0)
      expect(nudgeLine()).not.toBeInTheDocument()
    })

    it('leaves the day at / unplayed and its storage untouched (R18, R20)', async () => {
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

        const shared = await renderShared()
        await guess(user, 'C', wrongFlavour())
        await guess(user, 'C', 'Aeolian')
        expect(
          screen.getByRole('heading', { name: 'C Aeolian' }),
        ).toBeInTheDocument()
        shared.unmount()

        expect(localStorage.getItem('daily-groove:v2:results')).toBeNull()

        await renderPuzzle()
        expect(control()).toHaveAccessibleName(coaching.pickRootAndMode)
        expect(
          screen.queryByRole('heading', { name: 'C Aeolian' }),
        ).not.toBeInTheDocument()
        expect(screen.getByLabelText(header.currentStreakName)).toHaveTextContent(
          header.noStreakYet,
        )

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

      await renderPuzzle()
      await guess(user, 'C', wrongFlavour())
      expect(mockStore.save).toHaveBeenCalledTimes(1)
      expect(mockStore.save.mock.calls[0][0].date).toBe(TODAY())
    })
  })

  describe('the heard-in line (quick 001)', () => {
    const withTrack = GROOVES.find((g) => HEARD_IN[g.scale] !== undefined) as Groove
    const withoutTrack = GROOVES.find((g) => HEARD_IN[g.scale] === undefined) as Groove
    const line = (g: Groove) => solved.heardIn(HEARD_IN[g.scale])

    it('names the track for a shared groove opened on another day, after the solve (Done when 1, 3)', async () => {
      const user = userEvent.setup()
      await renderPuzzle(<GroovePuzzle groove={withTrack} mode="shared" />)

      expect(screen.queryByText(line(withTrack))).not.toBeInTheDocument()
      await guess(user, withTrack.root, withTrack.flavour)

      expect(
        within(screen.getByRole('status')).getByText(line(withTrack)),
      ).toBeInTheDocument()
    })

    it('shows the same line on a given-up day (Done when 3)', async () => {
      const user = userEvent.setup()
      await renderPuzzle(<GroovePuzzle groove={withTrack} mode="shared" />)
      const wrong = flavourOptions(new Date(), withTrack, GROOVES).filter(
        (f) => f !== withTrack.flavour,
      )

      for (const flavour of wrong.slice(0, 3)) {
        await guess(user, withTrack.root, flavour)
      }
      await user.click(giveUp() as HTMLElement)
      await user.click(giveUp() as HTMLElement)

      expect(
        within(screen.getByRole('status')).getByText(line(withTrack)),
      ).toBeInTheDocument()
    })

    it('renders no line for a scale with no entry (Done when 2)', async () => {
      const user = userEvent.setup()
      await renderPuzzle(<GroovePuzzle groove={withoutTrack} mode="shared" />)

      await guess(user, withoutTrack.root, withoutTrack.flavour)

      expect(screen.getByRole('status').textContent).not.toMatch(/heard this/i)
    })
  })

  describe('the next-groove line (quick 3)', () => {
    const acceptable = () => {
      const remaining = nextDayStart(new Date()).getTime() - Date.now()
      const minutes = Math.floor(remaining / 60000)
      return [minutes, minutes - 1].map((m) =>
        solved.nextGrooveIn({ hours: Math.floor(m / 60), minutes: m % 60 }),
      )
    }
    const isLine = (content: string) =>
      acceptable().includes(content) || content === solved.nextGrooveReady
    const line = () => screen.queryByText(isLine)

    it('says when the next groove lands once today is solved (Done when 1)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()
      expect(screen.queryByText(isLine)).not.toBeInTheDocument()

      await guess(user, ANSWER.root, ANSWER.flavour)

      expect(acceptable()).toContain(line()?.textContent)
    })

    it('says it on a given-up day too (Done when 2)', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, ANSWER.root, wrongFlavour())
      await guess(user, ANSWER.root, otherWrongFlavour())
      await guess(user, ANSWER.root, thirdWrongFlavour())
      await user.click(giveUp() as HTMLElement)
      await user.click(giveUp() as HTMLElement)

      expect(acceptable()).toContain(line()?.textContent)
    })

    it('says nothing on a shared groove (Done when 3)', async () => {
      const user = userEvent.setup()
      await renderPuzzle(<GroovePuzzle groove={GROOVE} mode="shared" />)

      await guess(user, ANSWER.root, ANSWER.flavour)

      expect(screen.getByRole('status')).toBeInTheDocument()
      expect(line()).not.toBeInTheDocument()
    })

    it('sits in the groove card above the tempo line, not in the answer box', async () => {
      const user = userEvent.setup()
      await renderPuzzle()

      await guess(user, ANSWER.root, ANSWER.flavour)

      const found = line() as HTMLElement
      expect(within(screen.getByRole('status')).queryByText(isLine)).not.toBeInTheDocument()
      const meta = screen.getByText(new RegExp(`^${puzzle.bpm({ bpm: GROOVE.bpm })} · `))
      expect(found.compareDocumentPosition(meta) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
      expect(
        screen.getByRole('heading', { name: GROOVE.name }).compareDocumentPosition(found) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
    })
  })

  describe('the framing on a shared groove (F12 E3)', () => {
    const renderShared = (groove: Groove = GROOVE) =>
      renderPuzzle(<GroovePuzzle groove={groove} mode="shared" />)

    const notice = () => screen.queryByText(puzzle.sharedNotice)

    const wayBack = () => screen.getByRole('link', { name: puzzle.backToToday })

    const solvedDaysAgo = (daysAgo: number): DailyResult => ({
      date: isoDate(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)),
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [SOLVING],
      solved: true,
      grooveId: 'groove-02',
    })

    const streakLine = () =>
      screen.getByLabelText(header.currentStreakName).textContent

    it('sits above the groove card, where the how-to-play box sits (R3, AC1)', async () => {
      const { container } = await renderShared()

      const framing = notice() as HTMLElement
      const name = screen.getByRole('heading', { name: GROOVE.name })
      expect(
        framing.compareDocumentPosition(name) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(
        container.querySelector(`section[aria-label="${APP_NAME}"]`),
      ).toContainElement(framing)
    })

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

      expect(inAppLinks()).toHaveLength(1)
      expect(inAppLinks()[0]).toHaveAttribute('href', '/')
      expect(wayBack()).toBe(inAppLinks()[0])
      everyOffSiteLinkReallyLeaves()

      await play(user)
      await guess(user, 'G', wrongFlavour())
      expect(inAppLinks()).toHaveLength(1)
      expect(inAppLinks()[0]).toHaveAttribute('href', '/')
      everyOffSiteLinkReallyLeaves()
    })

    it('adds the only link the daily page never had (R5, AC5)', async () => {
      await renderPuzzle()

      expect(inAppLinks()).toEqual([])
      everyOffSiteLinkReallyLeaves()
    })

    it('places the box the same way on a shared groove, with the way onward beneath it (F15 E5 R1, AC1)', async () => {
      const user = userEvent.setup()
      const { container } = await renderShared()

      await guess(user, 'C', 'Aeolian')

      expectEndedLayout(container)

      const invite = screen.getByRole('link', { name: routes.playTodayLink })
      const box = solutionPanel()
      const columns = columnsOf(container)

      expect(
        box.compareDocumentPosition(invite) & Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy()
      expect(box).not.toContainElement(invite)
      expect(columns[1]).toContainElement(invite)
      expect(inAppLinks()).toHaveLength(2)
      for (const link of inAppLinks()) expect(link).toHaveAttribute('href', '/')
    })

    it('has the same puzzle region and the same controls in both modes (R4, AC3)', async () => {
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
        play: screen.getByRole('button', { name: puzzle.playName.play })
          .textContent,
        transports: screen.getAllByRole('progressbar').length,
        coaching: coachingLine()?.textContent ?? null,
        simple: screen
          .getByRole('switch', { name: puzzle.simpleMode })
          .getAttribute('aria-checked'),
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

      const before = await renderPuzzle()
      const dayBefore = {
        coaching: coachingLine()?.textContent ?? null,
        streak: streakLine(),
      }
      expect(dayBefore.coaching).not.toBeNull()
      before.unmount()

      const user = userEvent.setup()
      const shared = await renderShared()
      expect(wayBack()).toHaveAttribute('href', '/')
      await guess(user, 'C', 'Aeolian')
      expect(mockStore.save).not.toHaveBeenCalled()
      shared.unmount()

      await renderPuzzle()
      expect({
        coaching: coachingLine()?.textContent ?? null,
        streak: streakLine(),
      }).toEqual(dayBefore)
    })
  })
})
