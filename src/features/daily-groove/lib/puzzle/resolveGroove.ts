import type { DailyResult, Groove } from '../../types'
import { selectGrooveForDate } from './selectGroove'

/**
 * Local Date at noon, so a DST step can never land on the wrong calendar day.
 * Matches the parse in `archive.ts` and `streak.ts`.
 */
function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

/**
 * The groove a past day played, or `null` when it can no longer be resolved.
 *
 * Selection is `hash(date) % grooves.length`, so a date alone re-resolves to a
 * different groove every time the catalogue grows. A record that carries the id
 * it played is therefore resolved by id — that is the path that survives growth.
 * Only a record saved before the id existed falls back to the date.
 *
 * A stored id that is no longer in the catalogue resolves to `null` and does
 * *not* fall back to the date: playing some other groove under that day's answer
 * is the exact failure this module exists to prevent. `null` is a real state —
 * a groove can leave the catalogue — and the caller disables the control.
 */
export function resolveGrooveForResult(
  result: DailyResult,
  grooves: Groove[],
): Groove | null {
  if (result.grooveId !== undefined) {
    return grooves.find((groove) => groove.id === result.grooveId) ?? null
  }
  if (grooves.length === 0) return null
  return selectGrooveForDate(parseIsoDate(result.date), grooves)
}
