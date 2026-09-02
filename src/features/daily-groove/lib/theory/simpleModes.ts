import type { Answer, Flavour } from '../../types'
import { familyOf, type Family } from './families'
import { seededShuffle } from './options'
import { isoDate } from '../puzzle/selectGroove'

type SimpleLickInput = {
  family: Family
  answer: Answer
  pool: Flavour[]
  date: Date
}

export function simpleLickMode(input: SimpleLickInput): Flavour | null {
  const { family, answer, pool, date } = input

  if (familyOf(answer.flavour) === family) return answer.flavour

  const candidates = pool.filter((flavour) => familyOf(flavour) === family)
  if (candidates.length === 0) return null

  return seededShuffle(candidates, isoDate(date))[0]
}
