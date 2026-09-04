import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DailyResult, Groove } from '../types'
import {
  control,
  flavourGroup,
  GROOVE,
  installPuzzleAudio,
  renderPuzzle,
  resetMockStore,
  seedFullSet,
  rootGroup,
  settle,
  SOLVING,
  teardownPuzzleAudio,
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
import { isoDate } from '@/lib/date'
import { header, intro, puzzle } from '@/lib/snippets'
import { GROOVES } from '../data/grooves.generated'
import { renderFeature } from '../testing/renderFeature'

describe('GroovePuzzle', () => {
  beforeEach(async () => {
    resetMockStore(mockStore)
    await seedFullSet()
    installPuzzleAudio()
  })

  afterEach(() => {
    teardownPuzzleAudio()
  })

  describe('how to play (F8 E3)', () => {
    const box = () =>
      screen.queryByRole('heading', { level: 2, name: intro.title })
    const helpToggle = () =>
      screen.queryByRole('button', { name: header.helpToggleName })
    const closeBox = () =>
      screen.getByRole('button', { name: intro.closeName })

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

    function seed(date: string) {
      localStorage.setItem(
        'daily-groove:v2:results',
        JSON.stringify({ version: 2, byDate: { [date]: solvedOn(date) } }),
      )
    }

    async function guessSomething(user: ReturnType<typeof userEvent.setup>) {
      await user.click(within(rootGroup()).getAllByRole('button')[0])
      await user.click(within(flavourGroup()).getAllByRole('button')[0])
      await user.click(control())
      await settle()
    }

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

    it('follows the masthead and precedes the groove card (F8 E3 R5, AC6)', async () => {
      const { container } = await renderFeature()

      const headings = Array.from(container.querySelectorAll('h1, h2'))
      const groove = selectGrooveForDate(new Date(), GROOVES)
      const at = (text: string) =>
        headings.findIndex((h) => h.textContent === text)

      const masthead = headings.findIndex((h) => h.tagName === 'H1')
      const introHeading = at(intro.title)
      const card = at(groove.name)

      expect(masthead).toBeGreaterThanOrEqual(0)
      expect(introHeading).toBeGreaterThan(masthead)
      expect(card).toBeGreaterThan(introHeading)
    })

    it('is not in the first painted frame, before the records load (F8 E3 R11, AC11)', async () => {
      const { unmount } = render(<GroovePuzzle />)

      expect(screen.getByText(puzzle.loading)).toBeInTheDocument()
      expect(screen.queryByText(intro.title)).toBeNull()

      await settle()
      unmount()
    })

    it('keeps the box up while a new player guesses (F8 E3 R16, R17, AC15)', async () => {
      const user = userEvent.setup()
      await renderFeature()
      expect(box()).toBeInTheDocument()

      await guessSomething(user)

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

      await renderFeature()
      expect(box()).toBeNull()
    })

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

      expect(box()).toBeInTheDocument()
      expect(helpToggle()).toBeNull()

      await user.click(closeBox())

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

      await renderFeature()
      expect(box()).toBeInTheDocument()
    })

    it('writes no key of its own, however often it is closed (F8 E3 R13, AC13)', async () => {
      await withRealStorage()
      const user = userEvent.setup()
      await renderFeature()

      await user.click(closeBox())
      await user.click(helpToggle() as HTMLElement)
      await user.click(closeBox())
      await settle()

      const instrumentKey = Array.from(
        { length: localStorage.length },
        (_, i) => localStorage.key(i) as string,
      )
      const allowed = ['daily-groove:v2:results', 'daily-groove:v1:prefs']
      expect(instrumentKey.filter((key) => !allowed.includes(key))).toEqual([])
    })

    it('explains the game when storage cannot be read at all (F8 E3 R15, AC14)', async () => {
      await withRealStorage()
      const getItem = vi
        .spyOn(localStorage, 'getItem')
        .mockImplementation(() => {
          throw new Error('storage disabled')
        })

      try {
        await renderFeature()

        expect(box()).toBeInTheDocument()
      } finally {
        getItem.mockRestore()
      }
    })
  })

  describe('the framing on a shared groove (F12 E3)', () => {
    const renderShared = (groove: Groove = GROOVE) =>
      renderPuzzle(<GroovePuzzle groove={groove} mode="shared" />)

    const solvedDaysAgo = (daysAgo: number): DailyResult => ({
      date: isoDate(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)),
      answer: { root: 'C', flavour: 'Aeolian' },
      attempts: [SOLVING],
      solved: true,
      grooveId: 'groove-02',
    })

    const helpBox = () =>
      screen.queryByRole('heading', { level: 2, name: intro.title })
    const helpToggle = () =>
      screen.queryByRole('button', { name: header.helpToggleName })

    it('follows the same new-or-lapsed rule for how to play in both modes (R7b, AC13)', async () => {
      const user = userEvent.setup()

      const first = await renderShared()
      expect(helpBox()).toBeInTheDocument()
      first.unmount()

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

      mockStore.getAll.mockResolvedValue([solvedDaysAgo(40)])
      await renderShared()
      expect(helpBox()).toBeInTheDocument()
    })
  })
})
