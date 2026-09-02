import type { Attempt, Root } from '../../types'
import { seededShuffle } from '../theory/options'

export const ELIMINATE_AFTER_MISSES = 2
export const ELIMINATED_PER_MISS = 2
export const LIVE_ROOT_FLOOR = 4

const NARROWABLE_ABOVE = LIVE_ROOT_FLOOR + ELIMINATED_PER_MISS

export function eliminatedRoots(
  pool: readonly Root[],
  answer: Root,
  attempts: readonly Attempt[],
  seed: string,
): Root[] {
  if (pool.length <= NARROWABLE_ABOVE) return []

  const candidates = seededShuffle(
    pool.filter((root) => root !== answer),
    `${seed}:eliminate`,
  )

  const byPlayer = new Set<Root>()
  const eliminated = new Set<Root>()
  let misses = 0

  for (const attempt of attempts) {
    if (attempt.rootMatched === false) byPlayer.add(attempt.root)
    if (attempt.correct !== false) continue

    misses += 1
    if (misses < ELIMINATE_AFTER_MISSES) continue

    const live = pool.filter(
      (root) => !byPlayer.has(root) && !eliminated.has(root),
    ).length
    if (live - ELIMINATED_PER_MISS < LIVE_ROOT_FLOOR) continue

    const taking = candidates
      .filter((root) => !byPlayer.has(root) && !eliminated.has(root))
      .slice(0, ELIMINATED_PER_MISS)

    for (const root of taking) eliminated.add(root)
  }

  return pool.filter((root) => eliminated.has(root))
}
