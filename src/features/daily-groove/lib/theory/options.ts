import { hashString } from '@/lib/hash'

/**
 * A tiny deterministic PRNG (mulberry32) so a numeric seed produces a stable
 * stream of pseudo-random numbers without any external dependency.
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/**
 * Deterministically shuffle a copy of `items` using a seeded Fisher–Yates.
 *
 * Exported because it is the feature's only seeded shuffle: `lib/puzzle/
 * selectGroove.ts` derives each lap's running order with it rather than
 * growing a second copy of the algorithm two directories away.
 */
export function seededShuffle<T>(items: T[], seed: string): T[] {
  const rng = mulberry32(hashString(seed))
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

/**
 * Build a multiple-choice option set: the correct answer plus seed-deterministic
 * distractors drawn from `pool` (excluding the correct value). No duplicates,
 * length `count` (default 4), and identical for the same seed. If the pool lacks
 * enough distinct distractors, the result is shorter than `count`.
 */
export function buildOptions(
  correct: string,
  pool: string[],
  seed: string,
  count = 4,
): string[] {
  // Unique distractors, excluding the correct value.
  const distractors = Array.from(new Set(pool)).filter((v) => v !== correct)
  const shuffledDistractors = seededShuffle(distractors, seed)
  const chosen = shuffledDistractors.slice(0, Math.max(0, count - 1))

  // Place the correct answer among the distractors deterministically.
  const combined = [correct, ...chosen]
  return seededShuffle(combined, `${seed}:place`)
}
