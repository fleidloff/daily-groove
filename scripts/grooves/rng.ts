/**
 * The generator's single source of chance.
 *
 * Nothing under scripts/grooves/ may call Math.random or read the clock in the
 * render path: every choice is drawn from a generator seeded by a label built
 * from the groove's `{ template, seed }` plus the stage making the choice. That
 * is what makes "the same spec renders the same audio" testable without ever
 * rendering audio.
 */

/**
 * Deterministic 32-bit string hash (FNV-1a variant), byte-for-byte the same
 * function as src/features/daily-groove/lib/selectGroove.ts, so the app and the
 * generator can never disagree about what a seed string means.
 */
export function hashString(input: string): number {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  // Force to an unsigned 32-bit integer.
  return hash >>> 0
}

/** Mulberry32: a small, fast, well-distributed 32-bit PRNG. */
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

/**
 * A generator for one labelled stream of choices. Two calls with the same label
 * yield the same sequence; different labels yield unrelated sequences, so
 * stages never share state or draw order.
 */
export function rngFor(label: string): () => number {
  return mulberry32(hashString(label))
}

/** Uniform choice from a non-empty list. */
export function pick<T>(rng: () => number, items: readonly T[]): T {
  if (items.length === 0) {
    throw new Error('pick: items must not be empty')
  }
  return items[Math.floor(rng() * items.length) % items.length]
}

/** Uniform integer in [lo, hi], both bounds inclusive. */
export function intBetween(rng: () => number, lo: number, hi: number): number {
  const low = Math.min(lo, hi)
  const high = Math.max(lo, hi)
  const span = high - low + 1
  return low + (Math.floor(rng() * span) % span)
}
