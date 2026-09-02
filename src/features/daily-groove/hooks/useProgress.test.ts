import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { Answer, Attempt, DailyResult } from '../types'
import type { ResultStore } from '../lib/persistence/storage'
import { useProgress } from './useProgress'

const TODAY = '2026-08-21'
const YESTERDAY = '2026-08-20'

const ANSWER: Answer = { root: 'C', flavour: 'Minor' }

const GROOVE_ID = 'groove-03'

function attempt(overrides: Partial<Attempt> = {}): Attempt {
  return {
    root: 'C',
    flavour: 'Dorian',
    correct: false,
    rootMatched: true,
    flavourMatched: false,
    ...overrides,
  }
}

const todayResult: DailyResult = {
  date: TODAY,
  answer: ANSWER,
  attempts: [attempt({ correct: true, flavourMatched: true, flavour: 'Minor' })],
  solved: true,
}

const yesterdayResult: DailyResult = {
  date: YESTERDAY,
  answer: { root: 'G', flavour: 'Dorian' },
  attempts: [
    attempt({ root: 'G', flavour: 'Dorian', correct: true, flavourMatched: true }),
  ],
  solved: true,
}

function makeStore(overrides: Partial<ResultStore> = {}): ResultStore {
  return {
    get: vi.fn(async () => null),
    getAll: vi.fn(async () => []),
    save: vi.fn(async () => {}),
    ...overrides,
  }
}

describe('useProgress', () => {
  it('empty store → loaded, streak 0, no stored record, no today result (AC5)', async () => {
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.streak).toBe(0)
    expect(result.current.todayResult).toBeNull()
    await expect(store.getAll()).resolves.toEqual([])
  })

  it("loads today's existing result and derives the streak from every record (E6 R3, AC4)", async () => {
    const store = makeStore({
      get: vi.fn(async () => todayResult),
      getAll: vi.fn(async () => [yesterdayResult, todayResult]),
    })
    const { result } = renderHook(() => useProgress(TODAY, store))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.todayResult).toEqual(todayResult)
    expect(result.current.streak).toBe(2)
    expect(store.getAll).toHaveBeenCalled()
  })

  it('an unsolved yesterday breaks the streak (R7, AC6)', async () => {
    const missed: DailyResult = { ...yesterdayResult, solved: false }
    const store = makeStore({
      get: vi.fn(async () => todayResult),
      getAll: vi.fn(async () => [missed, todayResult]),
    })
    const { result } = renderHook(() => useProgress(TODAY, store))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.streak).toBe(1)
  })

  it('derives the streak without writing anything (E3 R5, AC8)', async () => {
    const store = makeStore({
      get: vi.fn(async () => todayResult),
      getAll: vi.fn(async () => [yesterdayResult, todayResult]),
    })
    const { result } = renderHook(() => useProgress(TODAY, store))

    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.streak).toBe(2)
    expect(store.save).not.toHaveBeenCalled()
  })

  it('records the first wrong attempt as a stored record for today (R2, AC1)', async () => {
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    const first = attempt()
    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [first],
        solved: false,
      })
    })

    expect(store.save).toHaveBeenCalledTimes(1)
    expect(store.save).toHaveBeenCalledWith({
      date: TODAY,
      answer: ANSWER,
      attempts: [first],
      solved: false,
      grooveId: GROOVE_ID,
    })
    expect(result.current.todayResult).toEqual({
      date: TODAY,
      answer: ANSWER,
      attempts: [first],
      solved: false,
      grooveId: GROOVE_ID,
    })
    expect(result.current.streak).toBe(0)
  })

  it('rewrites the day on each further attempt rather than adding a record (R2)', async () => {
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    const first = attempt()
    const second = attempt({ flavour: 'Lydian' })

    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [first],
        solved: false,
      })
    })
    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [first, second],
        solved: false,
      })
    })

    expect(store.save).toHaveBeenCalledTimes(2)
    expect(result.current.todayResult?.attempts).toEqual([first, second])
    expect(
      vi.mocked(store.save).mock.calls.map(([record]) => record.date),
    ).toEqual([TODAY, TODAY])
  })

  it('a solving attempt marks the day solved and starts the streak (R2, R7)', async () => {
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    const winner = attempt({ flavour: 'Minor', correct: true, flavourMatched: true })
    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [winner],
        solved: true,
      })
    })

    expect(result.current.todayResult?.solved).toBe(true)
    expect(result.current.streak).toBe(1)
  })

  it('a solve advances the streak already on screen, with no remount (R4, AC2)', async () => {
    const store = makeStore({
      getAll: vi.fn(async () => [yesterdayResult]),
    })
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.todayResult).toBeNull()
    expect(result.current.streak).toBe(1)

    const winner = attempt({ flavour: 'Minor', correct: true, flavourMatched: true })
    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [winner],
        solved: true,
      })
    })

    expect(result.current.streak).toBe(2)
  })

  it('a solve through a non-persisting store leaves the streak alone (F12 E1 R19, AC9)', async () => {
    const store = makeStore({
      getAll: vi.fn(async () => [yesterdayResult]),
      persists: false,
    })
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.streak).toBe(1)

    const winner = attempt({ flavour: 'Minor', correct: true, flavourMatched: true })
    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [winner],
        solved: true,
      })
    })

    expect(result.current.streak).toBe(1)
    expect(result.current.todayResult).toBeNull()
  })

  it('still hands the record to save, so the seam stays the one that decides (F12 E1 R19)', async () => {
    const save = vi.fn<(result: DailyResult) => Promise<void>>(async () => {})
    const store = makeStore({ save, persists: false })
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [attempt({ flavour: 'Dorian', correct: false })],
        solved: false,
      })
    })

    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ date: TODAY, solved: false }),
    )
  })

  it('writes the day with the id of the groove it played (E5 R7, AC7)', async () => {
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    const first = attempt()
    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        attempts: [first],
        solved: false,
        grooveId: 'groove-03',
      })
    })

    expect(store.save).toHaveBeenCalledTimes(1)
    expect(store.save).toHaveBeenCalledWith(
      expect.objectContaining({ date: TODAY, grooveId: 'groove-03' }),
    )
    expect(result.current.todayResult?.grooveId).toBe('groove-03')
  })

  it('carries the groove id through to the day it derives (E5 R7, AC7)', async () => {
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        attempts: [attempt()],
        solved: false,
        grooveId: 'groove-11',
      })
    })

    expect(result.current.todayResult?.grooveId).toBe('groove-11')
  })

  it('loads a record naming a groove that has left the catalogue (E4 R10, AC10)', async () => {
    const retiredYesterday: DailyResult = {
      date: YESTERDAY,
      answer: { root: 'C', flavour: 'Blues' },
      attempts: [attempt({ root: 'C', flavour: 'Blues', correct: true, flavourMatched: true })],
      solved: true,
      grooveId: 'groove-05',
    }
    const retiredToday: DailyResult = {
      date: TODAY,
      answer: { root: 'A♭', flavour: 'Harmonic minor' },
      attempts: [
        attempt({ root: 'A♭', flavour: 'Harmonic minor', correct: true, flavourMatched: true }),
      ],
      solved: true,
      grooveId: 'groove-15',
    }

    const store = makeStore({
      get: vi.fn(async () => retiredToday),
      getAll: vi.fn(async () => [retiredYesterday, retiredToday]),
    })
    const { result } = renderHook(() => useProgress(TODAY, store))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.todayResult).toEqual(retiredToday)
    expect(result.current.todayResult?.grooveId).toBe('groove-15')
    expect(result.current.streak).toBe(2)
  })

  it('exposes no write path replay could reach (E5 R9, AC11)', async () => {
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(Object.keys(result.current).sort()).toEqual([
      'loaded',
      'newOrLapsed',
      'recordAttempt',
      'streak',
      'todayResult',
    ])
    const functions = Object.entries(result.current)
      .filter(([, value]) => typeof value === 'function')
      .map(([key]) => key)
    expect(functions).toEqual(['recordAttempt'])
  })

  it('a write that throws still leaves the guess in the session (R6, AC5)', async () => {
    const store = makeStore({
      save: vi.fn(async () => {
        throw new Error('quota exceeded')
      }),
    })
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    const first = attempt()
    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [first],
        solved: false,
      })
    })

    expect(result.current.todayResult?.attempts).toEqual([first])
  })

  it('records a given-up day with the reveal flag (E3 R9)', async () => {
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    const spent = [attempt(), attempt({ flavour: 'Lydian' }), attempt({ flavour: 'Ionian' })]
    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: spent,
        solved: false,
        revealed: true,
      })
    })

    expect(store.save).toHaveBeenCalledWith({
      date: TODAY,
      answer: ANSWER,
      attempts: spent,
      solved: false,
      grooveId: GROOVE_ID,
      revealed: true,
    })
    expect(result.current.todayResult?.revealed).toBe(true)
    expect(result.current.streak).toBe(0)
  })

  it('leaves the flag off a day that was not given up (E3 R13)', async () => {
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [attempt()],
        solved: false,
      })
    })

    const [record] = vi.mocked(store.save).mock.calls[0]
    expect(record.revealed).toBeUndefined()
    expect('revealed' in record).toBe(false)
    expect(result.current.todayResult?.revealed).toBeUndefined()
  })

  it('reports a player with nothing saved as new (F8 E3 R1)', async () => {
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.newOrLapsed).toBe(true)
  })

  it('reports a player who was here yesterday as neither (F8 E3 R2, R3)', async () => {
    const store = makeStore({
      get: vi.fn(async () => null),
      getAll: vi.fn(async () => [yesterdayResult]),
    })
    const { result } = renderHook(() => useProgress(TODAY, store))

    await waitFor(() => expect(result.current.loaded).toBe(true))
    expect(result.current.newOrLapsed).toBe(false)
  })

  it("holds the answer through today's first write, while the streak moves (F8 E3 R16)", async () => {
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.newOrLapsed).toBe(true)
    expect(result.current.streak).toBe(0)

    const winner = attempt({ flavour: 'Minor', correct: true, flavourMatched: true })
    await act(async () => {
      await result.current.recordAttempt({
        answer: ANSWER,
        grooveId: GROOVE_ID,
        attempts: [winner],
        solved: true,
      })
    })

    expect(result.current.streak).toBe(1)
    expect(result.current.newOrLapsed).toBe(true)
  })
})
