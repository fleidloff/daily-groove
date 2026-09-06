import type { Groove } from '../../types'
import { isoDate, parseIsoDate } from '@/lib/date'
import { seededShuffle } from '@/lib/theory/options'

// The rota epoch. The one value in the rota that deliberately moves: bumping it
// remaps every unplayed date, past and future. Every release that mints grooves
// bumps it. Epoch 1 names the order that existed before the epoch did and is
// never rendered by the seed, which is why this release's bump is 1 → 2.
export const ROTA_EPOCH = 2

export function dayIndexOf(iso: string): number {
  return Math.floor(parseIsoDate(iso).getTime() / 86_400_000)
}

export function orderFor(lap: number, grooves: Groove[], epoch: number = ROTA_EPOCH): Groove[] {
  const size = grooves.length
  const order = seededShuffle(grooves, `${epoch}:lap:${lap}`)

  if (lap === 0 || size < 2) return order

  if (size === 2) return seededShuffle(grooves, `${epoch}:lap:0`)

  const closing = seededShuffle(grooves, `${epoch}:lap:${lap - 1}`)[size - 1]
  if (order[0].id !== closing.id) return order

  ;[order[0], order[1]] = [order[1], order[0]]
  return order
}

export function selectGrooveForDate(date: Date, grooves: Groove[], pinnedId?: string): Groove {
  if (grooves.length === 0) {
    throw new Error('selectGrooveForDate: grooves must not be empty')
  }
  if (pinnedId) {
    const pinned = grooves.find((g) => g.id === pinnedId)
    if (pinned) return pinned
  }
  const dayIndex = dayIndexOf(isoDate(date))
  const lap = Math.floor(dayIndex / grooves.length)
  const position = ((dayIndex % grooves.length) + grooves.length) % grooves.length
  return orderFor(lap, grooves)[position]
}
