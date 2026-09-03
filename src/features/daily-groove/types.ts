export type { Answer, Attempt, Flavour, Groove, Root } from '@/lib/groove'

import type { Answer, Attempt } from '@/lib/groove'

export type DailyResult = {
  date: string
  answer: Answer
  attempts: Attempt[]
  solved: boolean
  grooveId?: string
  revealed?: boolean
}
