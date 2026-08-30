import type { Groove } from '../../types'
import { seededShuffle } from '../theory/options'

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
 * Days from 1970-01-01 to the given ISO calendar day.
 *
 * The day is parsed at 12:00 local — the same noon anchor `persistence/
 * streak.ts` uses — so the ±1h a DST transition moves the clock can never push
 * the value across a day boundary. The index is therefore a property of the
 * calendar day, not of when in it the page was opened.
 */
export function dayIndexOf(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  const noon = new Date(year, month - 1, day, 12, 0, 0, 0)
  return Math.floor(noon.getTime() / 86_400_000)
}

/**
 * The running order for one lap: a deterministic permutation of the whole
 * rotation, so a lap plays every groove exactly once.
 *
 * Laps are shuffled independently, which leaves one seam: lap `n` can open on
 * the groove lap `n - 1` closed with, and two identical days running is the
 * repeat this rotation most obviously exists to prevent. On a collision the
 * opener is swapped with the groove behind it — never with the groove at the
 * end, so a lap always closes on the groove its own shuffle put there.
 *
 * That invariant is what keeps this function cheap. The guard only has to look
 * at the previous lap's *shuffle*, not at its corrected order, so a lap costs
 * two shuffles and no recursion. Deriving the previous lap's corrected order
 * instead would chain back to lap 0 — roughly 1,300 laps for today's dates, and
 * more every day.
 *
 * The correction is a pure function of the lap, so every player sees the same
 * one. The displaced groove lands on day two of the new lap, two days after it
 * last played: a far weaker complaint than two days running, and the price of
 * keeping the pick stateless.
 */
function orderFor(lap: number, grooves: Groove[]): Groove[] {
  const size = grooves.length
  const order = seededShuffle(grooves, `lap:${lap}`)

  // Lap 0 has no lap before it; a rotation of one has no alternative to offer.
  if (lap === 0 || size < 2) return order

  // With two grooves the only sequence that never repeats is strict
  // alternation, so every lap is the same lap. Nothing to correct, and no
  // non-terminal slot to correct it with.
  if (size === 2) return seededShuffle(grooves, 'lap:0')

  const closing = seededShuffle(grooves, `lap:${lap - 1}`)[size - 1]
  if (order[0].id !== closing.id) return order

  ;[order[0], order[1]] = [order[1], order[0]]
  return order
}

/**
 * Pick the groove for a given date by walking a shuffled permutation of the
 * whole rotation: the calendar day becomes a day index, the index splits into a
 * lap and a position within it, and the groove is the one standing at that
 * position in the lap's running order.
 *
 * Every groove is therefore played once before any is played twice — that is a
 * property of a permutation, not a check bolted on. The pick reads no storage
 * and consults no history: it is a pure function of the date and the rotation,
 * identical for every player.
 */
export function selectGrooveForDate(date: Date, grooves: Groove[]): Groove {
  if (grooves.length === 0) {
    throw new Error('selectGrooveForDate: grooves must not be empty')
  }
  const dayIndex = dayIndexOf(isoDate(date))
  const lap = Math.floor(dayIndex / grooves.length)
  const position = ((dayIndex % grooves.length) + grooves.length) % grooves.length
  return orderFor(lap, grooves)[position]
}
