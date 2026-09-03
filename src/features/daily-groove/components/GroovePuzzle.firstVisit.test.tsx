import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { DailyResult } from '../types'
import {
  ANSWER,
  chipLabel,
  control,
  flavourGroup,
  flavours,
  GROOVE,
  guess,
  installPuzzleAudio,
  renderPuzzle,
  resetMockStore,
  rootGroup,
  seedPreferences,
  settle,
  SOLVING,
  storedDay,
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

const { prefsGate } = vi.hoisted(() => ({
  prefsGate: { hold: null as Promise<void> | null },
}))
vi.mock('../lib/persistence/preferences', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('../lib/persistence/preferences')>()
  return {
    ...actual,
    createLocalPreferenceStore: () => {
      const real = actual.createLocalPreferenceStore()
      return {
        async get() {
          if (prefsGate.hold) await prefsGate.hold
          return real.get()
        },
        update: (patch: Parameters<typeof real.update>[0]) => real.update(patch),
      }
    },
  }
})

import { GroovePuzzle } from './GroovePuzzle'
import { isoDate } from '@/lib/date'
import { simpleRootOptions } from '@/lib/theory/music'
import { FAMILIES } from '@/lib/theory/families'
import { coaching, puzzle } from '@/lib/snippets'

const PREFS_KEY = 'daily-groove:v1:prefs'

const modeSwitch = () => screen.getByRole('switch', { name: puzzle.simpleMode })

const chipTexts = (group: HTMLElement) =>
  within(group).getAllByRole('button').map(chipLabel)

const renderShared = () => renderPuzzle(<GroovePuzzle groove={GROOVE} mode="shared" />)

const storedPrefs = () => JSON.parse(localStorage.getItem(PREFS_KEY) ?? 'null')

const day = (daysAgo: number): DailyResult =>
  storedDay({
    date: isoDate(new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000)),
    attempts: [SOLVING],
    solved: true,
  })

describe('GroovePuzzle on a first visit', () => {
  beforeEach(() => {
    resetMockStore(mockStore)
    prefsGate.hold = null
    installPuzzleAudio()
  })

  afterEach(() => {
    teardownPuzzleAudio()
  })

  it('gives a first-time player six roots, Major or Minor, and the switch on (F22 E1 R1, AC1)', async () => {
    await renderPuzzle()

    expect(chipTexts(rootGroup())).toHaveLength(6)
    expect(chipTexts(rootGroup())).toEqual(simpleRootOptions(new Date(), ANSWER))
    expect(chipTexts(flavourGroup())).toEqual(FAMILIES)
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
  })

  it('writes simpleMode: true on the first visit, and is still Simple tomorrow with a result saved (F22 E1 R2, AC2)', async () => {
    const first = await renderPuzzle()
    expect(storedPrefs()).toEqual({ tapSounds: true, simpleMode: true })
    first.unmount()

    mockStore.getAll.mockResolvedValue([day(1)])
    await renderPuzzle()

    expect(chipTexts(rootGroup())).toHaveLength(6)
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
  })

  it('keeps the full set for a player with a result and nothing stored, and writes that down (F22 E1 R3, AC3)', async () => {
    mockStore.getAll.mockResolvedValue([day(1)])
    await renderPuzzle()

    expect(chipTexts(rootGroup())).toHaveLength(12)
    expect(chipTexts(flavourGroup())).toEqual(flavours())
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'false')
    expect(storedPrefs()).toEqual({ tapSounds: true, simpleMode: false })
  })

  it.each([
    ['false with no results', { simpleMode: false }, [], 12],
    [
      'true with forty results',
      { simpleMode: true },
      Array.from({ length: 40 }, (_, i) => day(i)),
      6,
    ],
  ])(
    'consults only the stored value: %s (F22 E1 R4, AC4)',
    async (_label, prefs, results, expected) => {
      await seedPreferences(prefs)
      mockStore.getAll.mockResolvedValue(results)
      await renderPuzzle()

      expect(chipTexts(rootGroup())).toHaveLength(expected)
      expect(storedPrefs().simpleMode).toBe(prefs.simpleMode)
    },
  )

  it('remembers a first-time player turning the switch off, and leaves tapSounds alone (F22 E1 R5, AC5)', async () => {
    const user = userEvent.setup()
    await seedPreferences({ tapSounds: false })
    const first = await renderPuzzle()
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')

    await user.click(modeSwitch())
    await settle()
    expect(storedPrefs()).toEqual({ tapSounds: false, simpleMode: false })
    first.unmount()

    await renderPuzzle()
    expect(chipTexts(rootGroup())).toHaveLength(12)
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'false')
  })

  it('shows the loading line, and no root group, until the preference is read (F22 E1 R6, AC6)', async () => {
    await seedPreferences({ simpleMode: true })
    let release!: () => void
    prefsGate.hold = new Promise((resolve) => {
      release = resolve
    })
    await renderPuzzle()

    expect(screen.getByText(puzzle.loading)).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: puzzle.rootGroup })).toBeNull()

    await act(async () => {
      release()
    })
    await settle()
    expect(chipTexts(rootGroup())).toHaveLength(6)
  })

  it('starts a first-time player in Simple on a shared groove (F22 E1 R7, AC7)', async () => {
    await renderShared()

    expect(chipTexts(rootGroup())).toHaveLength(6)
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
    expect(storedPrefs()).toEqual({ tapSounds: true, simpleMode: true })
  })

  it('gives a player with a daily result the full set on a shared groove (F22 E1 R7, AC7)', async () => {
    mockStore.getAll.mockResolvedValue([day(1)])
    await renderShared()

    expect(chipTexts(rootGroup())).toHaveLength(12)
    expect(storedPrefs().simpleMode).toBe(false)
  })

  it('lands on Simple, and says nothing, when storage cannot be read (F22 E1 R8, AC8)', async () => {
    const getItem = vi.spyOn(localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    const complained = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await renderPuzzle()

      expect(chipTexts(rootGroup())).toHaveLength(6)
      expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
      expect(complained).not.toHaveBeenCalled()
    } finally {
      getItem.mockRestore()
      complained.mockRestore()
    }
  })

  it('solves and records the day for a first-time player checking root and family (F22 E1 R9, AC9)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()

    await guess(user, 'C', 'Minor')

    expect(control()).toHaveAccessibleName(coaching.checkSolved)
    expect(screen.getByRole('heading', { name: 'C Aeolian' })).toBeInTheDocument()
    expect(mockStore.save).toHaveBeenCalledTimes(1)
    expect(mockStore.save).toHaveBeenCalledWith(
      expect.objectContaining({ solved: true, grooveId: GROOVE.id }),
    )
    const saved = mockStore.save.mock.calls[0][0] as DailyResult
    expect(saved.attempts).toHaveLength(1)
    expect(saved.attempts[0].correct).toBe(true)
  })
})
