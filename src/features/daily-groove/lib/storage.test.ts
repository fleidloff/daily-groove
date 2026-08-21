import { describe, it, expect, beforeEach, beforeAll } from 'vitest'
import type { DailyResult } from '../types'
import { createLocalStore } from './storage'

const STORAGE_KEY = 'daily-groove:v1:results'

// This jsdom setup does not expose a working `localStorage`, so install a small
// in-memory Storage implementation (the spec allows "in-memory/jsdom
// localStorage") that createLocalStore reads through the global `localStorage`.
beforeAll(() => {
  if (typeof globalThis.localStorage === 'undefined') {
    const store = new Map<string, string>()
    const memoryStorage: Storage = {
      get length() {
        return store.size
      },
      clear: () => store.clear(),
      getItem: (key: string) => (store.has(key) ? store.get(key)! : null),
      key: (index: number) => Array.from(store.keys())[index] ?? null,
      removeItem: (key: string) => {
        store.delete(key)
      },
      setItem: (key: string, value: string) => {
        store.set(key, String(value))
      },
    }
    Object.defineProperty(globalThis, 'localStorage', {
      configurable: true,
      value: memoryStorage,
    })
  }
})

const resultA: DailyResult = {
  date: '2026-08-21',
  guesses: { scale: 'C minor', chord: 'Cm' },
  correctness: { scale: true, chord: false },
}

const resultB: DailyResult = {
  date: '2026-08-20',
  guesses: { progression: 'Am–D–G' },
  correctness: { progression: false },
}

describe('createLocalStore', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips a saved result via get(date)', async () => {
    const store = createLocalStore()
    await store.save(resultA)
    expect(await store.get(resultA.date)).toEqual(resultA)
  })

  it('returns null for a date that was never saved', async () => {
    const store = createLocalStore()
    expect(await store.get('2000-01-01')).toBeNull()
  })

  it('getAll returns all saved results', async () => {
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
      date: resultA.date,
      guesses: { scale: 'D minor' },
      correctness: { scale: true },
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

  it('writes the versioned envelope shape under the storage key', async () => {
    const store = createLocalStore()
    await store.save(resultA)
    const raw = localStorage.getItem(STORAGE_KEY)
    expect(raw).not.toBeNull()
    expect(JSON.parse(raw as string)).toEqual({
      version: 1,
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
})
