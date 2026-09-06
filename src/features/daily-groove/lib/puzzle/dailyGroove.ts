import type { Groove } from '../../types'
import { isoDate } from '@/lib/date'
import { GROOVES } from '../../data/grooves.generated'
import { pinnedGrooveId } from '../persistence/storage'
import { selectGrooveForDate } from './selectGroove'

export function dailyGroove(now: Date): Groove {
  return selectGrooveForDate(now, GROOVES, pinnedGrooveId(isoDate(now)))
}
