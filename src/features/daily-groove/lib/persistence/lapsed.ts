import type { DailyResult } from '../../types'
import { parseIsoDate } from '../puzzle/selectGroove'

const MS_PER_DAY = 86_400_000

/**
 * How long a player may be away before the game explains itself again. Days,
 * not calendar months: month arithmetic buys nothing here and misbehaves at the
 * end of February.
 */
export const LAPSE_DAYS = 31

/**
 * No results, or nothing played in the last `LAPSE_DAYS` days.
 *
 * This reads the `date` of each record and nothing else. A day that was lost or
 * given up on is still a day the player was here, so `isQualifying` in
 * `streak.ts` — which asks whether a day was *solved* — is deliberately not
 * used: conflating the two would hide the explanation from someone who plays
 * daily and loses.
 *
 * Takes the record set as an argument and reads no storage of its own.
 */
export function isNewOrLapsed(results: DailyResult[], today: string): boolean {
  if (results.length === 0) return true

  // ISO `YYYY-MM-DD` sorts lexicographically, so the newest date is a string
  // comparison away and needs no parsing.
  const newest = results.reduce((latest, r) => (r.date > latest ? r.date : latest), results[0].date)

  // Both ends parsed at noon, so a DST shift between them cannot round a
  // 31-day gap up to 32.
  const days = Math.round(
    (parseIsoDate(today).getTime() - parseIsoDate(newest).getTime()) / MS_PER_DAY,
  )

  return days > LAPSE_DAYS
}
