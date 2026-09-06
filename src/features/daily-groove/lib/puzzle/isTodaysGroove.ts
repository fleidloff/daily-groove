import type { Groove } from '../../types'
import { dailyGroove } from './dailyGroove'

export function isTodaysGroove(groove: Groove, now: Date): boolean {
  return dailyGroove(now).uuid === groove.uuid
}
