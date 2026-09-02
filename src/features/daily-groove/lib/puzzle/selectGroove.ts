import type { Groove } from '../../types'
import { seededShuffle } from '../theory/options'

export function isoDate(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0, 0)
}

export function dayIndexOf(iso: string): number {
  const [year, month, day] = iso.split('-').map(Number)
  const noon = new Date(year, month - 1, day, 12, 0, 0, 0)
  return Math.floor(noon.getTime() / 86_400_000)
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
