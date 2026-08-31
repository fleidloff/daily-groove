import type { DailyResult } from '../../types'
import { isoDate, parseIsoDate } from '../puzzle/selectGroove'

/**
 * A day qualifies for the streak when it was solved, however many attempts it
 * took. A past day left unsolved does not qualify, and so breaks the run.
 */
export function isQualifying(r: DailyResult): boolean {
  return r.solved
}

/**
 * Step an ISO `YYYY-MM-DD` string back one calendar day, via the same
 * noon-anchored parse, and re-format it. Handles month and year rollovers.
 */
function previousDay(iso: string): string {
  const date = parseIsoDate(iso)
  date.setDate(date.getDate() - 1)
  return isoDate(date)
}

/**
 * Count the run of consecutive qualifying days ending at the anchor day. The
 * anchor is today when today qualifies, and yesterday otherwise: a day that has
 * not finished yet is not judged, so a run survives the night until the player
 * has had their chance at today.
 *
 * This is not a grace period and not a freeze. Only today gets the benefit of
 * being unfinished — every earlier day is judged, and one that is absent OR
 * present but unsolved ends the run where it stands.
 */
export function computeStreak(results: DailyResult[], today: string): number {
  const byDate = new Map<string, DailyResult>()
  for (const r of results) byDate.set(r.date, r)

  const todayResult = byDate.get(today)
  const anchor = todayResult && isQualifying(todayResult) ? today : previousDay(today)

  let streak = 0
  const cursor = parseIsoDate(anchor)

  while (true) {
    const key = isoDate(cursor)
    const result = byDate.get(key)
    if (!result || !isQualifying(result)) break
    streak += 1
    cursor.setDate(cursor.getDate() - 1)
  }

  return streak
}
