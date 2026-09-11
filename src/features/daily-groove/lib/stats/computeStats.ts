import type { DailyResult } from '../../types'
import { isoDate, parseIsoDate } from '@/lib/date'
import { computeStreak } from '../persistence/streak'
import type { AttemptBucket, ComputeStats, Distribution } from './types'

const WINDOW_DAYS = 7

function emptyDistribution(): Distribution {
  return { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, '6+': 0, revealed: 0 }
}

function bucketOf(result: DailyResult): AttemptBucket {
  if (result.revealed === true) return 'revealed'
  const count = Math.min(Math.max(result.attempts.length, 1), 6)
  return count === 6 ? '6+' : (String(count) as AttemptBucket)
}

function distribute(results: DailyResult[]): Distribution {
  const distribution = emptyDistribution()
  for (const result of results) distribution[bucketOf(result)] += 1
  return distribution
}

function windowStart(today: string): string {
  const start = parseIsoDate(today)
  start.setDate(start.getDate() - (WINDOW_DAYS - 1))
  return isoDate(start)
}

export const computeStats: ComputeStats = (results, today) => {
  const start = windowStart(today)
  const inWindow = results.filter((r) => r.date >= start)

  return {
    puzzlesPlayed: results.length,
    streak: computeStreak(results, today),
    attempts: { last7: distribute(inWindow), all: distribute(results) },
    solved: results.filter((r) => r.solved).length,
    revealed: results.filter((r) => r.revealed === true).length,
  }
}
