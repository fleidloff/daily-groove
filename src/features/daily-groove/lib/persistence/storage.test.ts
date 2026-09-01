import { describe, it, expect, afterEach, vi } from 'vitest'
import type { Attempt, DailyResult } from '../../types'
import {
  createLocalStore,
  createReadOnlyStore,
  type ResultStore,
} from './storage'

const STORAGE_KEY = 'daily-groove:v2:results'
const LEGACY_KEY = 'daily-groove:v1:results'

function attempt(root: Attempt['root'], flavour: string, correct: boolean): Attempt {
  return {
    root,
    flavour,
    correct,
    rootMatched: correct,
    flavourMatched: correct,
  }
}

const resultA: DailyResult = {
  date: '2026-08-21',
  answer: { root: 'C', flavour: 'Dorian' },
  attempts: [attempt('D', 'Dorian', false), attempt('C', 'Mixolydian', false)],
  solved: false,
}

const resultB: DailyResult = {
  date: '2026-08-20',
  answer: { root: 'A', flavour: 'Aeolian' },
  attempts: [attempt('A', 'Aeolian', true)],
  solved: true,
}

describe('createLocalStore', () => {
  it('round-trips a saved record via get(date) — answer, attempts and solved (R1, A1)', async () => {
    const store = createLocalStore()
    await store.save(resultA)
    expect(await store.get(resultA.date)).toEqual(resultA)
  })

  it('returns null for a date that was never saved', async () => {
    const store = createLocalStore()
    expect(await store.get('2000-01-01')).toBeNull()
  })

  it('getAll includes the saved record intact (R1, A1)', async () => {
    const store = createLocalStore()
    await store.save(resultA)
    await store.save(resultB)
    const all = await store.getAll()
    expect(all).toHaveLength(2)
    expect(all).toContainEqual(resultA)
    expect(all).toContainEqual(resultB)
  })

  it('getAll returns an empty array when nothing is saved', async () => {
    const store = createLocalStore()
    expect(await store.getAll()).toEqual([])
  })

  it('merges by date: saving the same date again overwrites it', async () => {
    const store = createLocalStore()
    await store.save(resultA)
    const updated: DailyResult = {
      ...resultA,
      attempts: [...resultA.attempts, attempt('C', 'Dorian', true)],
      solved: true,
    }
    await store.save(updated)
    expect(await store.get(resultA.date)).toEqual(updated)
    expect(await store.getAll()).toHaveLength(1)
  })

  it('persists across a fresh createLocalStore (simulating a reload)', async () => {
    const first = createLocalStore()
    await first.save(resultA)
    await first.save(resultB)

    const reloaded = createLocalStore()
    expect(await reloaded.get(resultA.date)).toEqual(resultA)
    expect(await reloaded.getAll()).toHaveLength(2)
  })

  it('writes a version-2 envelope under the v2 storage key (R1)', async () => {
    const store = createLocalStore()
    await store.save(resultA)
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string)).toEqual({
      version: 2,
      byDate: { [resultA.date]: resultA },
    })
  })

  // --- Epic 5: the groove a day played --------------------------------------

  describe('the groove id a day played (E5 R7, R8)', () => {
    const withId: DailyResult = { ...resultA, grooveId: 'groove-07' }

    it('round-trips a stored groove id through get and getAll (E5 R7, AC7, AC9)', async () => {
      const store = createLocalStore()
      await store.save(withId)

      expect(await store.get(withId.date)).toEqual(withId)
      expect((await store.get(withId.date))?.grooveId).toBe('groove-07')
      expect(await store.getAll()).toContainEqual(withId)
      expect((await store.getAll())[0].grooveId).toBe('groove-07')
    })

    it('keeps the v2 key and version — the field is additive, not a migration (E5 R8)', async () => {
      const store = createLocalStore()
      await store.save(withId)

      const raw = localStorage.getItem(STORAGE_KEY)
      expect(JSON.parse(raw as string)).toEqual({
        version: 2,
        byDate: { [withId.date]: withId },
      })
    })

    it('loads a record written without a groove id, every other field intact (E5 R8, AC8, AC9)', async () => {
      // A v2 envelope written by hand, exactly as a pre-Epic-5 session left it.
      const legacy = {
        date: '2026-08-19',
        answer: { root: 'B\u266d', flavour: 'Lydian' },
        attempts: [attempt('B\u266d', 'Lydian', true)],
        solved: true,
      }
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 2, byDate: { [legacy.date]: legacy } }),
      )

      const store = createLocalStore()
      const [loaded] = await store.getAll()

      expect(loaded).toEqual(legacy)
      expect(loaded.grooveId).toBeUndefined()
      expect('grooveId' in loaded).toBe(false)
      expect(loaded.answer).toEqual(legacy.answer)
      expect(loaded.attempts).toEqual(legacy.attempts)
      expect(loaded.solved).toBe(true)
      expect(await store.get(legacy.date)).toEqual(legacy)
    })

    it('round-trips both record shapes side by side (E5 R8, AC9)', async () => {
      const store = createLocalStore()
      await store.save(withId)
      await store.save(resultB)

      const all = await store.getAll()
      expect(all).toHaveLength(2)
      expect(all).toContainEqual(withId)
      expect(all).toContainEqual(resultB)
      expect(await store.get(withId.date)).toEqual(withId)
      expect(await store.get(resultB.date)).toEqual(resultB)
      expect((await store.get(resultB.date))?.grooveId).toBeUndefined()
    })
  })

  it('returns empty state when storage holds corrupt JSON', async () => {
    localStorage.setItem(STORAGE_KEY, 'not-json{')
    const store = createLocalStore()
    expect(await store.getAll()).toEqual([])
    expect(await store.get(resultA.date)).toBeNull()
  })

  it('returns empty state when storage holds a wrong-shaped blob', async () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nope: true }))
    const store = createLocalStore()
    expect(await store.getAll()).toEqual([])
  })

  describe('a feature-1 blob is ignored, not read (R5, AC4, A2)', () => {
    const v1Envelope = JSON.stringify({
      version: 1,
      byDate: {
        '2026-08-21': {
          date: '2026-08-21',
          guesses: { scale: 'C minor' },
          correctness: { scale: true },
        },
      },
    })

    it('ignores a v1 envelope left under the old key', async () => {
      localStorage.setItem(LEGACY_KEY, v1Envelope)
      const store = createLocalStore()
      expect(await store.getAll()).toEqual([])
      expect(await store.get('2026-08-21')).toBeNull()
    })

    it('ignores a v1-shaped blob sitting under the new key, without throwing', async () => {
      localStorage.setItem(STORAGE_KEY, v1Envelope)
      const store = createLocalStore()
      await expect(store.getAll()).resolves.toEqual([])
      await expect(store.get('2026-08-21')).resolves.toBeNull()
    })

    it('leaves the v1 blob in place rather than deleting it', async () => {
      localStorage.setItem(LEGACY_KEY, v1Envelope)
      const store = createLocalStore()
      await store.save(resultA)
      expect(localStorage.getItem(LEGACY_KEY)).toBe(v1Envelope)
    })
  })

  describe('a failing write does not throw (R6, AC5, A3)', () => {
    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('resolves rather than rejecting when setItem throws', async () => {
      vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => {
        throw new Error('QuotaExceededError')
      })
      const store = createLocalStore()
      await expect(store.save(resultA)).resolves.toBeUndefined()
    })
  })
})

/**
 * The seam a shared groove is played through (F12 E1 R18, AC9). Reads pass
 * through untouched — the streak the header shows has to stay honest — and the
 * write path is simply gone, so a shared session cannot record a day even by
 * accident.
 */
describe('createReadOnlyStore', () => {
  function fakeStore(): ResultStore {
    return {
      get: vi.fn().mockResolvedValue(resultA),
      getAll: vi.fn().mockResolvedValue([resultA, resultB]),
      save: vi.fn().mockResolvedValue(undefined),
    }
  }

  /**
   * `get` answers "what has been played on this date", and on a shared groove
   * the answer is always nothing — so it does NOT delegate.
   *
   * The tech spec's Step C1 asked for a delegating `get`, and that is the one
   * place it is wrong about its own PRD: today's saved record describes a
   * different groove, scored against a different answer. Delegating would open a
   * shared link that had arrived after the daily was solved as *already solved*,
   * with an attempt row belonging to another puzzle. R21 and AC11 are explicit
   * that a shared groove opens fresh every visit.
   */
  it('answers nothing for any date, whatever the inner store holds (R21, AC11)', async () => {
    const inner = fakeStore()
    const store = createReadOnlyStore(inner)

    expect(await store.get('2026-08-21')).toBeNull()
    expect(await store.get('1999-01-01')).toBeNull()
    // Not consulted at all: there is no date on which a shared groove has a
    // record to restore.
    expect(inner.get).not.toHaveBeenCalled()
  })

  it('reports that it persists nothing, so no caller holds its records (R19, AC9)', () => {
    expect(createReadOnlyStore(fakeStore()).persists).toBe(false)
    // The stores that do write leave the marker absent rather than `true`.
    expect(createLocalStore().persists).toBeUndefined()
  })

  // `getAll` is the asymmetric half: the streak on a shared page is the
  // player's real one, so every saved record still reaches the derivation.
  it('delegates getAll to the inner store and returns its value (R19, AC9)', async () => {
    const inner = fakeStore()
    const store = createReadOnlyStore(inner)

    expect(await store.getAll()).toEqual([resultA, resultB])
    expect(inner.getAll).toHaveBeenCalledTimes(1)
  })

  it('resolves save without writing through (R18, AC9)', async () => {
    const inner = fakeStore()
    const store = createReadOnlyStore(inner)

    await expect(store.save(resultA)).resolves.toBeUndefined()
    expect(inner.save).not.toHaveBeenCalled()
  })

  it('leaves the inner store untouched by a save, on any date (R18)', async () => {
    const inner = fakeStore()
    const store = createReadOnlyStore(inner)

    await store.save(resultA)
    await store.save(resultB)

    expect(inner.save).not.toHaveBeenCalled()
    // The reads still answer with what the inner store holds.
    expect(await store.getAll()).toEqual([resultA, resultB])
  })
})
