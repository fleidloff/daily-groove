import type { Groove } from '../../types'
import { isoDate, parseIsoDate } from '@/lib/date'
import { seededShuffle } from '@/lib/theory/options'

export function dayIndexOf(iso: string): number {
  return Math.floor(parseIsoDate(iso).getTime() / 86_400_000)
}

function orderFor(lap: number, grooves: Groove[]): Groove[] {
  const size = grooves.length
  const order = seededShuffle(grooves, `lap:${lap}`)

  if (lap === 0 || size < 2) return order

  if (size === 2) return seededShuffle(grooves, 'lap:0')

  const closing = seededShuffle(grooves, `lap:${lap - 1}`)[size - 1]
  if (order[0].id !== closing.id) return order

  ;[order[0], order[1]] = [order[1], order[0]]
  return order
}

export function selectGrooveForDate(date: Date, grooves: Groove[]): Groove {
  if (grooves.length === 0) {
    throw new Error('selectGrooveForDate: grooves must not be empty')
  }
  const dayIndex = dayIndexOf(isoDate(date))
  const lap = Math.floor(dayIndex / grooves.length)
  const position = ((dayIndex % grooves.length) + grooves.length) % grooves.length
  return orderFor(lap, grooves)[position]
}
