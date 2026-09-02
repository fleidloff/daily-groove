import { hashString } from '../../src/lib/hash.ts'

export { hashString }

function mulberry32(seed: number): () => number {
  let state = seed >>> 0
  return function next(): number {
    state = (state + 0x6d2b79f5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function rngFor(label: string): () => number {
  return mulberry32(hashString(label))
}

export function pick<T>(rng: () => number, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('pick: items must not be empty')
  }
  return items[Math.floor(rng() * items.length) % items.length]
}

export function intBetween(rng: () => number, lo: number, hi: number): number {
  const low = Math.min(lo, hi)
  const high = Math.max(lo, hi)
  const span = high - low + 1
  return low + (Math.floor(rng() * span) % span)
}
