import type { DailyResult } from '../types'
import { isoDate } from './selectGroove'

/**
 * A day qualifies for the streak when the player got at least one attempted
 * attribute correct — i.e. any value in `correctness` is `true`.
 */
export function isQualifying(r: DailyResult): boolean {
  return Object.values(r.correctness).some((correct) => correct === true)
}

/**
 * Parse an ISO `YYYY-MM-DD` string into a local Date at noon. Noon avoids any
 * DST edge where midnight ± a step could land on the wrong calendar day.
 */
function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

/**
 * Count the run of consecutive qualifying days ending at `today`. Walks back one
 * calendar day at a time, stopping at the first day that is absent OR present
 * but non-qualifying. If today itself is absent/non-qualifying the streak is 0
 * (the run must include today).
 */
export function computeStreak(results: DailyResult[], today: string): number {
  const byDate = new Map<string, DailyResult>()
  for (const r of results) byDate.set(r.date, r)

  let streak = 0
  const cursor = parseIsoDate(today)

  while (true) {
    const key = isoDate(cursor)
    const result = byDate.get(key)
    if (!result || !isQualifying(result)) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}
