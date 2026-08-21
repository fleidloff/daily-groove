import type { Groove } from '../types'

/**
 * Format a Date as an ISO calendar day "YYYY-MM-DD" using the LOCAL calendar
 * day (not UTC), so "today" matches the player's wall clock.
 */
export function isoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Deterministic 32-bit string hash (FNV-1a variant). Stable and dependency-free
 * so the same seed always maps to the same non-negative integer.
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

/**
 * Pick the groove for a given date by hashing its ISO day to an index over the
 * whole set. This is a per-date pick, not a sequential walk, so it never
 * exhausts as days advance (it may revisit a groove out of order).
 */
export function selectGrooveForDate(date: Date, grooves: Groove[]): Groove {
  if (grooves.length === 0) {
    throw new Error('selectGrooveForDate: grooves must not be empty')
  }
  const index = hashString(isoDate(date)) % grooves.length
  return grooves[index]
}
