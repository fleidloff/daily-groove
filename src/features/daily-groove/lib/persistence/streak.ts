import type { DailyResult } from '../../types'
import { isoDate, parseIsoDate } from '../puzzle/selectGroove'

export function isQualifying(r: DailyResult): boolean {
  return r.solved
}

function isOver(r: DailyResult | undefined): boolean {
  return r !== undefined && (r.solved || r.revealed === true)
}

function previousDay(iso: string): string {
  const date = parseIsoDate(iso)
  date.setDate(date.getDate() - 1)
  return isoDate(date)
}

export function computeStreak(results: DailyResult[], today: string): number {
  const byDate = new Map<string, DailyResult>()
  for (const r of results) byDate.set(r.date, r)

  const anchor = isOver(byDate.get(today)) ? today : previousDay(today)

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
