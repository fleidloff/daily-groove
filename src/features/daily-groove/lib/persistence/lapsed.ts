import type { DailyResult } from '../../types'
import { parseIsoDate } from '../puzzle/selectGroove'

const MS_PER_DAY = 86_400_000

export const LAPSE_DAYS = 31

export function isNewOrLapsed(results: DailyResult[], today: string): boolean {
  if (results.length === 0) return true

  const newest = results.reduce((latest, r) => (r.date > latest ? r.date : latest), results[0].date)

  const days = Math.round(
    (parseIsoDate(today).getTime() - parseIsoDate(newest).getTime()) / MS_PER_DAY,
  )

  return days > LAPSE_DAYS
}
