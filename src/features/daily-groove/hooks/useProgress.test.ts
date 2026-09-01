import { describe, it, expect, vi } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import type { Answer, Attempt, DailyResult } from '../types'
import type { ResultStore } from '../lib/persistence/storage'
import { useProgress } from './useProgress'

const TODAY = '2026-08-21'
const YESTERDAY = '2026-08-20'

const ANSWER: Answer = { root: 'C', flavour: 'Minor' }

/**
 * The groove today played. `DayProgress` carries it so the record remembers
 * which audio the day was played against (E5 R7): resolving by date alone
 * re-points at a different groove the moment the catalogue grows.
 */
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

/** A fully-controllable mock `ResultStore`. */
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
    // Still 0 under the anchor-shift rule (Epic 3): today is unsolved so the
    // anchor falls back to yesterday, and yesterday is absent too.
    expect(result.current.streak).toBe(0)
    expect(result.current.todayResult).toBeNull()
    // The emptiness the streak is derived from: the hook no longer hands the
    // record list out, so the store is where "there is nothing yet" is read.
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
    // Both days were solved and are consecutive up to today → streak 2 (AC6).
    // Two, and not one, is what proves both stored records reached the derive:
    // the walk only gets to yesterday if `getAll()`'s full list feeds it.
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
    // Unchanged by the anchor-shift rule (Epic 3): today is solved, so the
    // anchor is today; the walk then stops at an unsolved yesterday. The shift
    // is not a grace period — a past day left unsolved still breaks the run.
    expect(result.current.streak).toBe(1)
  })

  it('derives the streak without writing anything (E3 R5, AC8)', async () => {
    // R5 keeps the streak derived, never persisted. Before this, nothing
    // asserted it: a refactor that handed `computeStreak` a store and cached
    // its result would satisfy every other streak test in the suite.
    const store = makeStore({
      get: vi.fn(async () => todayResult),
      getAll: vi.fn(async () => [yesterdayResult, todayResult]),
    })
    const { result } = renderHook(() => useProgress(TODAY, store))

    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(result.current.streak).toBe(2)
    expect(store.save).not.toHaveBeenCalled()
  })

  // --- C1: the day's record is written after every check, not only on a solve

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
    // ...and the day is readable back through the hook, before any solve.
    expect(result.current.todayResult).toEqual({
      date: TODAY,
      answer: ANSWER,
      attempts: [first],
      solved: false,
      grooveId: GROOVE_ID,
    })
    // An unsolved day does not count toward the streak. Still 0 under the
    // anchor-shift rule (Epic 3): the anchor falls back to yesterday, and this
    // fixture has no yesterday to find.
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
    // One record, not two: both writes carry today's date, so the second
    // rewrites the day rather than adding a second row to the record set.
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
    // Unchanged by the anchor-shift rule (Epic 3): solving today puts the
    // anchor back on today, and there is no yesterday to extend the run.
    expect(result.current.streak).toBe(1)
  })

  it('a solve advances the streak already on screen, with no remount (R4, AC2)', async () => {
    // Arriving the morning after a solve: yesterday is in the store, today is
    // untouched. The anchor shift is what makes this 1 rather than 0 (Epic 3).
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

    // Same mounted hook — no remount, no reload. The streak is a derivation over
    // the result set that `recordAttempt` just updated, so the badge's number
    // moves 1 → 2 in place (R4, AC2).
    expect(result.current.streak).toBe(2)
  })

  // --- Feature 12, Epic 1: a store that persists nothing feeds nothing ------

  /**
   * The mirror image of "a solve advances the streak already on screen".
   *
   * `recordAttempt` merges the day into `all` *before* the write, so a failing
   * store never costs the player their guess. A shared groove is played through
   * a store whose `save` keeps nothing by design, and merging there would make
   * the panel read "streak now N+1" for a play that left no trace — the streak
   * would fall back on the next reload (F12 E1 R19, AC9).
   */
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

    // The number the header shows is byte-identical to what it was before.
    expect(result.current.streak).toBe(1)
    // And the day itself is still unplayed as far as this hook is concerned.
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

    // `useProgress` does not decide whether to write — it only declines to hold
    // what it is told will not be kept. The read-only store's own `save` is what
    // drops the record.
    expect(save).toHaveBeenCalledTimes(1)
    expect(save).toHaveBeenCalledWith(
      expect.objectContaining({ date: TODAY, solved: false }),
    )
  })

  // --- Epic 5: the record remembers the groove it played --------------------

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

  // --- Epic 4 (feature-7), Step C4: a retired groove's record still loads ----

  it('loads a record naming a groove that has left the catalogue (E4 R10, AC10)', async () => {
    // `groove-05` was one of the two Blues grooves Epic 4 deleted from
    // catalogue.json outright — no retirement flag, no allowlist, the row is
    // simply gone. Nothing resolves a `grooveId` back to a `Groove` (feature-6
    // deleted `resolveGroove.ts` along with the archive), so a stored id with
    // no matching entry is inert rather than dangling: the day still loads and
    // still counts. This pins that, so a future lookup-by-id cannot be added
    // without a failing test explaining what it breaks.
    const retiredYesterday: DailyResult = {
      date: YESTERDAY,
      // The answer is kept verbatim too — stored answers are never migrated.
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
    // Loaded, intact, and nothing threw on the way.
    expect(result.current.todayResult).toEqual(retiredToday)
    expect(result.current.todayResult?.grooveId).toBe('groove-15')
    // Both retired days count: the streak reads `solved` and `date`, never the
    // groove the day was played against.
    expect(result.current.streak).toBe(2)
  })

  it('exposes no write path replay could reach (E5 R9, AC11)', async () => {
    // A structural guard, not a behavioural one: replay must never gain a way
    // to touch the record, so the hook's surface is pinned. A new mutator here
    // is a deliberate decision, and this assertion is where it gets made.
    const store = makeStore()
    const { result } = renderHook(() => useProgress(TODAY, store))
    await waitFor(() => expect(result.current.loaded).toBe(true))

    expect(Object.keys(result.current).sort()).toEqual([
      'loaded',
      // Added by F8 E3: who arrived, decided once at load (F8 E3 R16).
      'newOrLapsed',
      'recordAttempt',
      'streak',
      'todayResult',
    ])
    // The one function on the surface is the check path, not a playback path.
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
  // --- Epic 3 (feature-7): a given-up day is recorded distinguishably -------

  // Step B4 — E3 R9, R13
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
      // Given up is not solved — the two endings stay distinguishable.
      solved: false,
      grooveId: GROOVE_ID,
      revealed: true,
    })
    expect(result.current.todayResult?.revealed).toBe(true)
    // Giving up is not a win, so it starts no run.
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
    // Absent, not `false`: a record written before this epic and an unrevealed
    // one written after it are the same record.
    expect(record.revealed).toBeUndefined()
    expect('revealed' in record).toBe(false)
    expect(result.current.todayResult?.revealed).toBeUndefined()
  })

  // --- F8 Epic 3: who arrived, decided once when the records load -----------

  // Step C1 — F8 E3 R1, R2, R3
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

  // Step C2 — F8 E3 R16: latched at load, not derived from the record set
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

    // One write, two behaviours: the streak is a derivation over the record set
    // and moves; "new or lapsed" describes how the player *arrived* and does
    // not. A `useMemo` over `all` would flip this to `false` and pull the
    // explanation off the screen mid-read.
    expect(result.current.streak).toBe(1)
    expect(result.current.newOrLapsed).toBe(true)
  })

})
