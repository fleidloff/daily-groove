import type { Answer, Attempt, Flavour, Root } from '../../types'
import { eliminatedRoots } from '../puzzle/narrowing'
import { isoDate } from '@/lib/date'

export type RuledOut = {
  roots: Root[]
  flavours: Flavour[]
  eliminatedCount: number
}

export function ruledOut(args: {
  attempts: readonly Attempt[]
  answer: Answer
  roots: readonly Root[]
  date: Date
}): RuledOut {
  const { attempts, answer, roots, date } = args

  const eliminated = new Set<Root>(
    eliminatedRoots(roots, answer.root, attempts, isoDate(date)),
  )
  const byPlayer = new Set<Root>(
    attempts.filter((a) => a.rootMatched === false).map((a) => a.root),
  )

  const flavours: Flavour[] = []
  for (const attempt of attempts) {
    if (attempt.flavourMatched !== false) continue
    if (!flavours.includes(attempt.flavour)) flavours.push(attempt.flavour)
  }

  return {
    roots: roots.filter((root) => byPlayer.has(root) || eliminated.has(root)),
    flavours,
    eliminatedCount: eliminated.size,
  }
}
