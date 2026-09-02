import type { Groove } from '../../types'
import { GROOVES } from '../../data/grooves.generated'
import { selectGrooveForDate } from './selectGroove'

export function isTodaysGroove(groove: Groove, now: Date): boolean {
  return selectGrooveForDate(now, GROOVES)?.uuid === groove.uuid
}
