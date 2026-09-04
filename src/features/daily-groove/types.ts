export type { Answer, Attempt, Flavour, Groove, Root, HeardIn } from '@/lib/groove'

import type { Answer, Attempt } from '@/lib/groove'

export type NextGroove =
  | { ready: true }
  | { ready: false; hours: number; minutes: number }

export type DailyResult = {
  date: string
  answer: Answer
  attempts: Attempt[]
  solved: boolean
  grooveId?: string
  revealed?: boolean
}
