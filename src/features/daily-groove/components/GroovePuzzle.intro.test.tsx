/**
 * One of five files holding the composed puzzle's tests. **The grouping rule,
 * and where a new case goes, is documented at the top of
 * `GroovePuzzle.page.test.tsx`** — read it before adding one here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DailyResult, Groove } from '../types'
// The shared setup — fixtures, the fake audio context, the render and the
// accessible-name queries — has one home (F14 E2 R5). Everything below the
// `vi.mock` block is imported from it rather than restated here.
import {
  control,
  flavourGroup,
  GROOVE,
  installPuzzleAudio,
  renderPuzzle,
  resetMockStore,
  rootGroup,
  settle,
  SOLVING,
  teardownPuzzleAudio,
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

describe('GroovePuzzle', () => {
  beforeEach(() => {
    resetMockStore(mockStore)
    installPuzzleAudio()
  })

  afterEach(() => {
    teardownPuzzleAudio()
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

  /**
   * F12 Epic 3, Track A. One case of that block belongs to this region: who
   * sees the how-to-play box is the same question on a shared groove as it is
   * on the daily page. Its siblings are about the shared framing, the header
   * and the page, and sit in the files named for those (F14 E2 R6).
   */
  describe('the framing on a shared groove (F12 E3)', () => {
    const renderShared = (groove: Groove = GROOVE) =>
      renderPuzzle(<GroovePuzzle groove={groove} mode="shared" />)

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
  })
})
