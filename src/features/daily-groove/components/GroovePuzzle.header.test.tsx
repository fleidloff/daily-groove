/**
 * One of five files holding the composed puzzle's tests. **The grouping rule,
 * and where a new case goes, is documented at the top of
 * `GroovePuzzle.page.test.tsx`** — read it before adding one here.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DailyResult, Groove } from '../types'
// The shared setup — fixtures, the fake audio context, the render and the
// accessible-name queries — has one home (F14 E2 R5). Everything below the
// `vi.mock` block is imported from it rather than restated here.
import {
  advance,
  control,
  dotStates,
  GROOVE,
  guess,
  installPuzzleAudio,
  loopFraction,
  otherWrongFlavour,
  play,
  renderPuzzle,
  resetMockStore,
  rootGroup,
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
import { isoDate } from '../lib/puzzle/selectGroove'
import { APP_NAME } from '@/lib/branding'

describe('GroovePuzzle', () => {
  beforeEach(() => {
    resetMockStore(mockStore)
    installPuzzleAudio()
  })

  afterEach(() => {
    teardownPuzzleAudio()
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

  /**
   * F12 Epic 3, Track A. One case of that block belongs to this region: the
   * streak pill reads the same on a shared groove as it does on the daily
   * page. Its siblings are about the shared framing, the how-to-play box and
   * the page, and sit in the files named for those (F14 E2 R6).
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

    /** The streak pill's whole line, as the header renders it. */
    const streakLine = () =>
      screen.getByLabelText(/current streak/i).textContent

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

  })
})
