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
 * The app and the generator share one hash, so they can never disagree about
 * what a seed string means. Imported by relative path with the extension —
 * the mechanism manifest.ts already uses to reach into src/ — because the `@/`
 * alias does not resolve from scripts/.
 */
import { hashString } from '../../src/lib/hash.ts'

export { hashString }

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
