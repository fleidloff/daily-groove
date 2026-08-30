import { hashString } from '@/lib/hash'
import type { Groove } from '../../types'

/**
 * Re-exported for the feature's own modules (lib/theory/options.ts seeds its
 * distractor shuffle with it). The one implementation lives in src/lib/hash.ts
 * because the groove generator imports it too — see that file's header before
 * touching anything about it.
 */

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
