import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DailyResult, Groove } from '../types'
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

const { mockStore } = await vi.hoisted(async () => {
  const { createMockStore } = await import('../testing/puzzleHarness')
  return { mockStore: createMockStore() }
})
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

  const giveUp = () =>
    screen.queryByRole('button', {
      name: /give up and show the answer|end the day and show the answer/i,
    })

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
      expect(screen.queryByText('Saturday, 29 August')).toBeNull()
      expect(
        screen.getByText(/· Saturday, 29 August$/),
      ).toBeInTheDocument()
      expect(screen.queryByText('Saturday')).not.toBeInTheDocument()
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

  describe('sharing the groove (F12 E2)', () => {
    const shareControl = () => screen.getByRole('button', { name: 'Share' })

    const link = () => `${window.location.origin}/groove/${GROOVE.uuid}`

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

      await play(user)
      await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
      await advance(loopFraction(0.25))

      await user.click(shareControl())
      await waitFor(() => expect(share).toHaveBeenCalledTimes(1))

      expect(
        screen.getByRole('button', { name: 'Stop the loop' }),
      ).toBeInTheDocument()
      await advance(loopFraction(0.25))
      expect(
        screen.getByRole('button', { name: 'Stop the loop' }),
      ).toBeInTheDocument()

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

      await user.click(shareControl())
      await waitFor(() => expect(share).toHaveBeenCalledTimes(1))
      expect(share).toHaveBeenCalledWith({ url: link() })
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

      await renderPuzzle()
      expect(streakLine()).toBe(sharedHeader)
    })
  })
})
