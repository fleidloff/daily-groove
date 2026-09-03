import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { Attempt, DailyResult, Groove, Root } from '../types'

const { mockStore } = vi.hoisted(() => ({
  mockStore: {
    get: vi.fn(),
    getAll: vi.fn(),
    save: vi.fn(),
  },
}))
vi.mock('../lib/persistence/storage', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/persistence/storage')>()),
  createLocalStore: () => mockStore,
}))

import { usePuzzleSession } from './usePuzzleSession'
import {
  createReadOnlyStore,
  type ResultStore,
} from '../lib/persistence/storage'
import { flavourOptions } from '@/lib/theory/music'
import { isoDate } from '@/lib/date'
import { GROOVES } from '../data/grooves.generated'

const GROOVE: Groove = {
  id: 'groove-01',
  uuid: '18e13a23-e06f-4d5a-8f11-915cd59a5509',
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

const DAY = new Date(2026, 7, 29, 12, 0, 0)
const TODAY = () => isoDate(DAY)
const YESTERDAY = () => isoDate(new Date(2026, 7, 28, 12, 0, 0))

const flavours = () => flavourOptions(DAY, GROOVE, GROOVES)
const wrongFlavour = () => flavours().find((f) => f !== 'Minor') as string
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

async function renderSession() {
  const rendered = renderHook(() => usePuzzleSession(GROOVE, DAY))
  await waitFor(() => expect(rendered.result.current.hydrated).toBe(true))
  return rendered
}

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
    mockStore.get.mockReset().mockResolvedValue(null)
    mockStore.getAll.mockReset().mockResolvedValue([])
    mockStore.save.mockReset().mockResolvedValue(undefined)
  })

  it('opens an untouched day, unhydrated until the record is read (AC1)', async () => {
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

    expect(result.current.attempts).toEqual([miss('C', wrong, true)])
    expect(result.current.solved).toBe(false)
    expect(result.current.canCheck).toBe(false)

    await act(async () => {
      result.current.check()
    })
    expect(result.current.attempts).toHaveLength(1)

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
    expect(result.current.selectedRoot).toBeNull()
    expect(result.current.selectedFlavour).toBeNull()

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
    expect(result.current.streak).toBe(1)
  })

  it('hydrates exactly once, so a later write cannot overwrite live play (AC1)', async () => {
    const { result } = await renderSession()
    const wrong = wrongFlavour()

    await guess(result, 'C', wrong)
    await act(async () => {
      result.current.selectRoot('D')
    })

    expect(result.current.selectedRoot).toBe('D')
    expect(result.current.attempts).toHaveLength(1)
  })

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

    await act(async () => {
      result.current.check()
    })
    expect(mockStore.save).not.toHaveBeenCalled()

    await guess(result, 'C', wrongFlavour())
    expect(mockStore.save).toHaveBeenCalledTimes(1)

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

    expect(result.current.streak).toBe(0)

    await guess(result, 'C', 'Minor')
    expect(result.current.streak).toBe(1)

    expect(Object.keys(result.current)).not.toContain('history')
  })

  it('passes "new or lapsed" through from useProgress (F8 E3 R16, R17)', async () => {
    const { result } = await renderSession()

    expect(result.current.newOrLapsed).toBe(true)

    await guess(result, 'C', wrongFlavour())
    expect(result.current.newOrLapsed).toBe(true)
  })

  it('reports a player who was here yesterday as neither (F8 E3 R3)', async () => {
    const yesterday: DailyResult = {
      date: YESTERDAY(),
      answer: { root: 'G', flavour: 'Dorian' },
      attempts: [miss('C', 'Lydian', false)],
      solved: false,
    }
    mockStore.getAll.mockResolvedValue([yesterday])

    const { result } = await renderSession()

    expect(result.current.newOrLapsed).toBe(false)
  })

  it("derives the day's answer from the groove's own fields (AC1)", async () => {
    const { result } = await renderSession()

    expect(result.current.answer).toEqual({
      root: GROOVE.root,
      flavour: GROOVE.flavour,
    })
  })

  it('clears the half a miss ruled out, and keeps the half it did not (R19a, R19b)', async () => {
    const { result } = await renderSession()
    const wrong = wrongFlavour()

    await guess(result, 'G', wrong)
    expect(result.current.selectedRoot).toBeNull()
    expect(result.current.selectedFlavour).toBeNull()

    await guess(result, 'C', wrong)

    expect(result.current.selectedRoot).toBe('C')
    expect(result.current.selectedFlavour).toBeNull()
    expect(result.current.solved).toBe(false)
    expect(result.current.revealed).toBe(false)
  })

  it('reveal() ends the day and records it as given up (E3 R7, R9)', async () => {
    const { result } = await renderSession()
    const wrong = wrongFlavour()
    const other = otherWrongFlavour()

    await guess(result, 'C', wrong)
    await guess(result, 'G', wrong)
    await guess(result, 'D', other)
    expect(result.current.revealed).toBe(false)
    const spent = result.current.attempts
    expect(spent).toHaveLength(3)

    await act(async () => {
      result.current.reveal()
    })

    expect(result.current.revealed).toBe(true)
    expect(result.current.solved).toBe(false)
    expect(result.current.attempts).toEqual(spent)
    expect(mockStore.save).toHaveBeenCalledTimes(4)
    expect(mockStore.save).toHaveBeenLastCalledWith({
      date: TODAY(),
      answer: { root: 'C', flavour: 'Minor' },
      attempts: spent,
      solved: false,
      grooveId: GROOVE.id,
      revealed: true,
    })
  })

  it('takes no further guess once revealed (E3 R7)', async () => {
    const { result } = await renderSession()
    await guess(result, 'G', wrongFlavour())

    await act(async () => {
      result.current.reveal()
    })

    expect(result.current.canCheck).toBe(false)
    await act(async () => {
      result.current.selectFlavour(otherWrongFlavour())
    })
    await act(async () => {
      result.current.check()
    })
    expect(result.current.attempts).toHaveLength(1)
    expect(mockStore.save).toHaveBeenCalledTimes(2)
  })

  it('a solved day ignores reveal(), and writes nothing (E3 R11)', async () => {
    const { result } = await renderSession()
    await guess(result, 'C', 'Minor')
    expect(result.current.solved).toBe(true)
    expect(mockStore.save).toHaveBeenCalledTimes(1)

    await act(async () => {
      result.current.reveal()
    })

    expect(result.current.revealed).toBe(false)
    expect(mockStore.save).toHaveBeenCalledTimes(1)
  })

  it('hydrates a revealed day as over and unplayable (E3 R8, AC9)', async () => {
    const wrong = wrongFlavour()
    const stored: DailyResult = {
      date: TODAY(),
      answer: { root: 'C', flavour: 'Minor' },
      attempts: [miss('G', wrong, false), miss('D', wrong, false), miss('E', wrong, false)],
      solved: false,
      revealed: true,
    }
    mockStore.get.mockResolvedValue(stored)
    mockStore.getAll.mockResolvedValue([stored])

    const { result } = await renderSession()

    expect(result.current.revealed).toBe(true)
    expect(result.current.solved).toBe(false)
    expect(result.current.canCheck).toBe(false)
    expect(result.current.attempts).toEqual(stored.attempts)
    expect(result.current.streak).toBe(0)
  })

  it('hydrates a record written without the flag as unrevealed (E3 R13, AC13)', async () => {
    const wrong = wrongFlavour()
    const stored: DailyResult = {
      date: TODAY(),
      answer: { root: 'C', flavour: 'Minor' },
      attempts: [miss('G', wrong, false)],
      solved: false,
    }
    mockStore.get.mockResolvedValue(stored)
    mockStore.getAll.mockResolvedValue([stored])

    const { result } = await renderSession()

    expect(result.current.revealed).toBe(false)
    await guess(result, 'D', wrong)
    expect(result.current.attempts).toHaveLength(2)
  })

  const DORIAN: Groove = { ...GROOVE, flavour: 'Dorian', scale: 'C Dorian' }

  async function renderModal(simple: boolean) {
    const rendered = renderHook(
      ({ mode }: { mode: boolean }) => usePuzzleSession(DORIAN, DAY, mode),
      { initialProps: { mode: simple } },
    )
    await waitFor(() => expect(rendered.result.current.hydrated).toBe(true))
    return rendered
  }

  it('grades the flavour half by family in simple mode (E5 R5, AC4)', async () => {
    const { result } = await renderModal(true)

    await guess(result, 'C', 'Minor')

    expect(result.current.solved).toBe(true)
    expect(result.current.attempts).toEqual<Attempt[]>([
      {
        root: 'C',
        flavour: 'Minor',
        correct: true,
        rootMatched: true,
        flavourMatched: true,
      },
    ])
  })

  it('grades the same guess as a miss in the full puzzle (E5 R5, AC4)', async () => {
    const { result } = await renderModal(false)

    await guess(result, 'C', 'Minor')

    expect(result.current.solved).toBe(false)
    expect(result.current.attempts[0].flavourMatched).toBe(false)
  })

  it('misses a major family guess on a minor day (E5 R5, AC5)', async () => {
    const { result } = await renderModal(true)

    await guess(result, 'C', 'Major')

    expect(result.current.solved).toBe(false)
    expect(result.current.attempts[0].rootMatched).toBe(true)
    expect(result.current.attempts[0].flavourMatched).toBe(false)
  })

  it('keeps the day when the mode is switched mid-play (E5 R8, AC8)', async () => {
    const { result, rerender } = await renderModal(false)

    await guess(result, 'G', 'Lydian')
    await guess(result, 'D', 'Lydian')
    const spent = result.current.attempts
    const writes = mockStore.save.mock.calls.length

    await act(async () => {
      rerender({ mode: true })
    })

    expect(result.current.attempts).toEqual(spent)
    expect(result.current.attempts).toHaveLength(2)
    expect(mockStore.save.mock.calls).toHaveLength(writes)
    expect(result.current.answer).toEqual({ root: 'C', flavour: 'Dorian' })
    expect(result.current.solved).toBe(false)
    expect(result.current.revealed).toBe(false)
  })

  it('grades the next guess the new way after a mid-day switch (E5 R8, AC8)', async () => {
    const { result, rerender } = await renderModal(false)

    await guess(result, 'G', 'Lydian')

    await act(async () => {
      rerender({ mode: true })
    })

    await guess(result, 'C', 'Minor')
    expect(result.current.solved).toBe(true)
    expect(result.current.attempts).toHaveLength(2)

    const second = await renderModal(true)
    await guess(second.result, 'C', 'Minor')
    expect(second.result.current.solved).toBe(true)
  })

  it('clears the ruled-out half in simple mode too, naming no root (R19a, R1)', async () => {
    const { result } = await renderModal(true)

    await guess(result, 'G', 'Major')
    await guess(result, 'D', 'Major')

    expect(result.current.attempts).toHaveLength(2)
    expect(result.current.selectedRoot).toBeNull()
    expect(result.current.selectedFlavour).toBeNull()
  })

  it('records a simple-mode solve as a solved day (E5 R9, AC9)', async () => {
    const { result } = await renderModal(true)

    await guess(result, 'C', 'Minor')

    const saved = mockStore.save.mock.calls.at(-1)?.[0] as DailyResult
    expect(saved.solved).toBe(true)
    expect(saved.date).toBe(TODAY())
    expect(saved.answer).toEqual({ root: 'C', flavour: 'Dorian' })
    expect(saved.attempts.at(-1)?.flavour).toBe('Minor')
  })

  function injectable() {
    const inner = {
      get: vi.fn().mockResolvedValue(null),
      getAll: vi.fn().mockResolvedValue([]),
      save: vi.fn().mockResolvedValue(undefined),
    }
    return { inner, store: createReadOnlyStore(inner as ResultStore) }
  }

  async function renderInjected(store: ResultStore) {
    const rendered = renderHook(() =>
      usePuzzleSession(GROOVE, DAY, false, store),
    )
    await waitFor(() => expect(rendered.result.current.hydrated).toBe(true))
    return rendered
  }

  it('reads the day through the injected store, not the singleton (R18)', async () => {
    const { inner, store } = injectable()

    const { result } = await renderInjected(store)

    expect(inner.getAll).toHaveBeenCalledTimes(1)
    expect(inner.get).not.toHaveBeenCalled()
    expect(mockStore.get).not.toHaveBeenCalled()
    expect(mockStore.getAll).not.toHaveBeenCalled()
    expect(result.current.attempts).toEqual([])
  })

  it('records nothing on a checked guess through a read-only store (R18, AC9)', async () => {
    const { inner, store } = injectable()
    const { result } = await renderInjected(store)

    await guess(result, 'G', wrongFlavour())

    expect(result.current.attempts).toHaveLength(1)
    expect(result.current.solved).toBe(false)
    expect(inner.save).not.toHaveBeenCalled()
    expect(mockStore.save).not.toHaveBeenCalled()
  })

  it('records nothing on a solve or a reveal either (R18, AC9)', async () => {
    const { inner, store } = injectable()
    const { result } = await renderInjected(store)

    await guess(result, 'C', 'Minor')
    expect(result.current.solved).toBe(true)

    const second = injectable()
    const { result: given } = await renderInjected(second.store)
    await act(async () => {
      given.current.reveal()
    })
    expect(given.current.revealed).toBe(true)

    expect(inner.save).not.toHaveBeenCalled()
    expect(second.inner.save).not.toHaveBeenCalled()
    expect(mockStore.save).not.toHaveBeenCalled()
  })

  it('still reports the streak the injected store\u2019s records imply (R19)', async () => {
    const { inner, store } = injectable()
    const solvedYesterday: DailyResult = {
      date: YESTERDAY(),
      answer: { root: 'C', flavour: 'Minor' },
      attempts: [SOLVING],
      solved: true,
      grooveId: 'groove-01',
    }
    inner.getAll.mockResolvedValue([solvedYesterday])

    const { result } = await renderInjected(store)

    expect(result.current.streak).toBe(1)

    await guess(result, 'G', wrongFlavour())
    expect(result.current.streak).toBe(1)
    expect(inner.save).not.toHaveBeenCalled()
  })

  it('leaves the streak where it was once the shared play is over (R19, AC9)', async () => {
    const { inner, store } = injectable()
    const solvedYesterday: DailyResult = {
      date: YESTERDAY(),
      answer: { root: 'C', flavour: 'Minor' },
      attempts: [SOLVING],
      solved: true,
      grooveId: 'groove-01',
    }
    inner.getAll.mockResolvedValue([solvedYesterday])

    const first = await renderInjected(store)
    await guess(first.result, 'C', 'Minor')
    expect(first.result.current.solved).toBe(true)
    expect(inner.save).not.toHaveBeenCalled()
    first.unmount()

    const { result } = await renderInjected(store)
    expect(result.current.streak).toBe(1)
    expect(result.current.attempts).toEqual([])
  })

  it('falls back to the module singleton when no store is given (R23)', async () => {
    const { result } = await renderSession()

    await guess(result, 'G', wrongFlavour())

    expect(mockStore.save).toHaveBeenCalledTimes(1)
    expect(result.current.attempts).toHaveLength(1)
  })
})
