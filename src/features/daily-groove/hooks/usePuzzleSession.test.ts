import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { Attempt, DailyResult, Groove, Root } from '../types'

// Mock the persistence seam so `useProgress` reads and writes a controllable
// store — no real localStorage. `useProgress` defaults to this module-singleton.
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

import { usePuzzleSession } from './usePuzzleSession'
import { flavourOptions } from '../lib/theory/music'
import { isoDate } from '../lib/puzzle/selectGroove'

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

/** The day the session is played on, fixed so the record's date is knowable. */
const DAY = new Date(2026, 7, 29, 12, 0, 0)
const TODAY = () => isoDate(DAY)
const YESTERDAY = () => isoDate(new Date(2026, 7, 28, 12, 0, 0))

/** The day's four flavour chips, resolved exactly as the puzzle resolves them. */
const flavours = () => flavourOptions(DAY, GROOVE)
/** A flavour that is on offer today but is not the answer. */
const wrongFlavour = () => flavours().find((f) => f !== 'Minor') as string
/** A second wrong flavour, so a third guess can differ from the second. */
const otherWrongFlavour = () =>
  flavours().filter((f) => f !== 'Minor' && f !== wrongFlavour())[0]

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

/** Render the hook and wait for the saved day to be read into it. */
async function renderSession() {
  const rendered = renderHook(() => usePuzzleSession(GROOVE, DAY))
  await waitFor(() => expect(rendered.result.current.hydrated).toBe(true))
  return rendered
}

/** Pick a pair and check it, as the guessing card's three presses would. */
async function guess(
  result: { current: ReturnType<typeof usePuzzleSession> },
  root: Root,
  flavour: string,
) {
  await act(async () => {
    result.current.selectRoot(root)
  })
  await act(async () => {
    result.current.selectFlavour(flavour)
  })
  await act(async () => {
    result.current.check()
  })
}

describe('usePuzzleSession', () => {
  beforeEach(() => {
    // Default persistence: empty store, save resolves.
    mockStore.get.mockReset().mockResolvedValue(null)
    mockStore.getAll.mockReset().mockResolvedValue([])
    mockStore.save.mockReset().mockResolvedValue(undefined)
  })

  it('opens an untouched day, unhydrated until the record is read (AC1)', async () => {
    // A store that never resolves: the session never leaves its loading state,
    // so no fresh game can be painted on top of a day already in progress.
    mockStore.get.mockReturnValue(new Promise<DailyResult | null>(() => {}))
    mockStore.getAll.mockReturnValue(new Promise<DailyResult[]>(() => {}))

    const { result } = renderHook(() => usePuzzleSession(GROOVE, DAY))

    expect(result.current.hydrated).toBe(false)
    expect(result.current.selectedRoot).toBeNull()
    expect(result.current.selectedFlavour).toBeNull()
    expect(result.current.attempts).toEqual([])
    expect(result.current.solved).toBe(false)
    expect(result.current.canCheck).toBe(false)
  })

  it('hydrates an empty day into a fresh session (AC1)', async () => {
    const { result } = await renderSession()

    expect(result.current.hydrated).toBe(true)
    expect(result.current.selectedRoot).toBeNull()
    expect(result.current.selectedFlavour).toBeNull()
    expect(result.current.attempts).toEqual([])
    expect(result.current.solved).toBe(false)
  })

  it('needs both halves before a check is offered (AC1)', async () => {
    const { result } = await renderSession()

    expect(result.current.canCheck).toBe(false)

    await act(async () => {
      result.current.selectRoot('C')
    })
    expect(result.current.selectedRoot).toBe('C')
    // A root alone is not enough.
    expect(result.current.canCheck).toBe(false)

    await act(async () => {
      result.current.selectFlavour(wrongFlavour())
    })
    expect(result.current.selectedFlavour).toBe(wrongFlavour())
    expect(result.current.canCheck).toBe(true)
  })

  it('replaces rather than accumulates a selection (AC1)', async () => {
    const { result } = await renderSession()

    await act(async () => {
      result.current.selectRoot('C')
    })
    await act(async () => {
      result.current.selectRoot('G')
    })

    expect(result.current.selectedRoot).toBe('G')
  })

  it('appends a scored attempt on check, and refuses the same pair twice (AC1)', async () => {
    const { result } = await renderSession()
    const wrong = wrongFlavour()

    await guess(result, 'C', wrong)

    // The attempt is scored against the groove's own root and flavour.
    expect(result.current.attempts).toEqual([miss('C', wrong, true)])
    expect(result.current.solved).toBe(false)
    // The same pair can never be submitted twice in a row.
    expect(result.current.canCheck).toBe(false)

    await act(async () => {
      result.current.check()
    })
    expect(result.current.attempts).toHaveLength(1)

    // Changing a half hands the check back.
    await act(async () => {
      result.current.selectFlavour(otherWrongFlavour())
    })
    expect(result.current.canCheck).toBe(true)
  })

  it('solves the day on the right pair, and takes no attempt after (AC1)', async () => {
    const { result } = await renderSession()

    await guess(result, 'C', wrongFlavour())
    await guess(result, 'C', 'Minor')

    expect(result.current.solved).toBe(true)
    expect(result.current.attempts).toEqual([
      miss('C', wrongFlavour(), true),
      SOLVING,
    ])
    expect(result.current.canCheck).toBe(false)

    // A solved day stops accepting input, and no further attempt is appended.
    await act(async () => {
      result.current.selectRoot('G')
    })
    expect(result.current.selectedRoot).toBe('C')
    await act(async () => {
      result.current.check()
    })
    expect(result.current.attempts).toHaveLength(2)
    expect(mockStore.save).toHaveBeenCalledTimes(2)
  })

  it('hydrates the attempts of a day left mid-game (AC1)', async () => {
    const wrong = wrongFlavour()
    const stored: DailyResult = {
      date: TODAY(),
      answer: { root: 'C', flavour: 'Minor' },
      attempts: [miss('C', wrong, true), miss('G', wrong, false)],
      solved: false,
    }
    mockStore.get.mockResolvedValue(stored)
    mockStore.getAll.mockResolvedValue([stored])

    const { result } = await renderSession()

    expect(result.current.attempts).toEqual(stored.attempts)
    expect(result.current.solved).toBe(false)
    // The last pair checked is the pair the chips come back showing.
    expect(result.current.selectedRoot).toBe('G')
    expect(result.current.selectedFlavour).toBe(wrong)

    // The next guess counts as the third attempt, not the first.
    await guess(result, 'D', wrong)
    expect(result.current.attempts).toHaveLength(3)
  })

  it('hydrates a solved day as solved and locked (AC1)', async () => {
    const stored: DailyResult = {
      date: TODAY(),
      answer: { root: 'C', flavour: 'Minor' },
      attempts: [SOLVING],
      solved: true,
    }
    mockStore.get.mockResolvedValue(stored)
    mockStore.getAll.mockResolvedValue([stored])

    const { result } = await renderSession()

    expect(result.current.solved).toBe(true)
    expect(result.current.attempts).toEqual([SOLVING])
    expect(result.current.canCheck).toBe(false)
    // The day's streak is derived from the stored results, not persisted.
    expect(result.current.streak).toBe(1)
  })

  it('hydrates exactly once, so a later write cannot overwrite live play (AC1)', async () => {
    const { result } = await renderSession()
    const wrong = wrongFlavour()

    // Each check writes a record, which changes `todayResult`. Re-hydrating on
    // that change would throw away the selection the player has since made.
    await guess(result, 'C', wrong)
    await act(async () => {
      result.current.selectRoot('D')
    })

    expect(result.current.selectedRoot).toBe('D')
    expect(result.current.attempts).toHaveLength(1)
  })

  // Moved from GroovePuzzle.test.tsx: the record written on every check is the
  // session's own concern, and asserts on the store rather than on any render.
  it('writes the day after every check, not only on a solve (E5 R2, AC1)', async () => {
    const { result } = await renderSession()
    const wrong = wrongFlavour()

    await guess(result, 'C', wrong)

    expect(mockStore.save).toHaveBeenCalledTimes(1)
    expect(mockStore.save).toHaveBeenLastCalledWith({
      date: TODAY(),
      answer: { root: 'C', flavour: 'Minor' },
      attempts: [miss('C', wrong, true)],
      solved: false,
      // The day now records the groove it played (E5 R7, AC7).
      grooveId: GROOVE.id,
    })

    await guess(result, 'C', 'Minor')

    expect(mockStore.save).toHaveBeenCalledTimes(2)
    expect(mockStore.save).toHaveBeenLastCalledWith({
      date: TODAY(),
      answer: { root: 'C', flavour: 'Minor' },
      attempts: [miss('C', wrong, true), SOLVING],
      solved: true,
      grooveId: GROOVE.id,
    })
  })

  it('writes nothing when a check is refused (AC1)', async () => {
    const { result } = await renderSession()

    // Neither half picked: nothing to score, so nothing to record.
    await act(async () => {
      result.current.check()
    })
    expect(mockStore.save).not.toHaveBeenCalled()

    await guess(result, 'C', wrongFlavour())
    expect(mockStore.save).toHaveBeenCalledTimes(1)

    // The same pair again: rejected by the store, so no second record.
    await act(async () => {
      result.current.check()
    })
    expect(mockStore.save).toHaveBeenCalledTimes(1)
  })

  it('keeps the guess in the session when the write fails (AC1)', async () => {
    mockStore.save.mockRejectedValue(new Error('quota exceeded'))
    const { result } = await renderSession()
    const wrong = wrongFlavour()

    await guess(result, 'C', wrong)

    expect(result.current.attempts).toEqual([miss('C', wrong, true)])
  })

  it('exposes the streak the day is played against, and no record list (AC1, E6 R3a)', async () => {
    const yesterday: DailyResult = {
      date: YESTERDAY(),
      answer: { root: 'G', flavour: 'Dorian' },
      attempts: [miss('C', 'Lydian', false)],
      solved: false,
    }
    mockStore.get.mockResolvedValue(null)
    mockStore.getAll.mockResolvedValue([yesterday])

    const { result } = await renderSession()

    // Yesterday was left unsolved, so it starts no run.
    expect(result.current.streak).toBe(0)

    // Solving today moves the streak immediately — no reload. That the derive
    // still sees every stored record is what the number proves.
    await guess(result, 'C', 'Minor')
    expect(result.current.streak).toBe(1)

    // The list of past records is not handed out any more (E6 R3a, AC5a).
    expect(Object.keys(result.current)).not.toContain('history')
  })

  it("derives the day's answer from the groove's own fields (AC1)", async () => {
    const { result } = await renderSession()

    expect(result.current.answer).toEqual({
      root: GROOVE.root,
      flavour: GROOVE.flavour,
    })
  })
})
