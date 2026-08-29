import { describe, it, expect, afterEach, vi } from 'vitest'
import type { Attempt, DailyResult } from '../types'
import { createLocalStore } from './storage'

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
