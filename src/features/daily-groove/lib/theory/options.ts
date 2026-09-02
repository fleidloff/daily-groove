import { hashString } from '@/lib/hash'

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

export function seededShuffle<T>(items: T[], seed: string): T[] {
  const rng = mulberry32(hashString(seed))
  const out = items.slice()
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

export function buildOptions(
  correct: string,
  pool: string[],
  seed: string,
  count = 4,
): string[] {
  const distractors = Array.from(new Set(pool)).filter((v) => v !== correct)
  const shuffledDistractors = seededShuffle(distractors, seed)
  const chosen = shuffledDistractors.slice(0, Math.max(0, count - 1))

  const combined = [correct, ...chosen]
  return seededShuffle(combined, `${seed}:place`)
}
