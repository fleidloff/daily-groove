import type { Attempt } from '../../types'
import { confirmedHalves } from './confirmed'

export type CoachingFamily = 'general' | 'colour' | 'tonic'

export type CoachingPosition = {
  family: CoachingFamily
  index: number
}

type Half = 'roots' | 'flavours'

function missCount(attempts: readonly Attempt[]): number {
  return attempts.filter((attempt) => !attempt.correct).length
}

function entryMiss(attempts: readonly Attempt[], half: Half): number | null {
  for (let length = 1; length <= attempts.length; length++) {
    const prefix = attempts.slice(0, length)
    if (confirmedHalves(prefix)[half].length > 0) return missCount(prefix)
  }
  return null
}

export function coachingPosition(
  attempts: readonly Attempt[],
): CoachingPosition {
  const rootEntry = entryMiss(attempts, 'roots')
  const flavourEntry = entryMiss(attempts, 'flavours')
  const misses = missCount(attempts)

  const at = (family: CoachingFamily, entry: number): CoachingPosition => ({
    family,
    index: Math.max(0, misses - entry),
  })

  if (rootEntry !== null && flavourEntry !== null) {
    return flavourEntry > rootEntry
      ? at('tonic', flavourEntry)
      : at('colour', rootEntry)
  }
  if (rootEntry !== null) return at('colour', rootEntry)
  if (flavourEntry !== null) return at('tonic', flavourEntry)

  return { family: 'general', index: misses }
}
