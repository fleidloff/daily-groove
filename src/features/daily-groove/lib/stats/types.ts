import type { DailyResult } from '../../types'

export type AttemptBucket = '1' | '2' | '3' | '4' | '5' | '6+' | 'revealed'

export type Distribution = Record<AttemptBucket, number>

export type Stats = {
  puzzlesPlayed: number
  streak: number
  attempts: { last7: Distribution; all: Distribution }
  solved: number
  revealed: number
}

export type ComputeStats = (results: DailyResult[], today: string) => Stats
