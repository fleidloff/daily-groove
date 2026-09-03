import { coaching } from '@/lib/snippets'
import type { Attempt } from '../../types'

export type FeedbackTone = 'neutral' | 'warm' | 'solved'

export type Feedback = { message: string; tone: FeedbackTone }

const REVEAL_AFTER_MISSES = 3

const OPENING: Feedback = {
  message: coaching.opening,
  tone: 'neutral',
}

const SOLVED: Feedback = {
  message: coaching.solved,
  tone: 'solved',
}

const ROOT_MATCHED: Feedback = {
  message: coaching.rootMatched,
  tone: 'warm',
}

const FLAVOUR_MATCHED: Feedback = {
  message: coaching.flavourMatched,
  tone: 'warm',
}

const NEITHER_MATCHED: Feedback = {
  message: coaching.neitherMatched,
  tone: 'warm',
}

type MatchedHalf = 'root' | 'flavour' | 'neither'

const WRONG_GUESS: Record<MatchedHalf, Feedback> = {
  root: ROOT_MATCHED,
  flavour: FLAVOUR_MATCHED,
  neither: NEITHER_MATCHED,
}

function matchedHalf(attempt: Attempt): MatchedHalf {
  if (attempt.rootMatched && !attempt.flavourMatched) return 'root'
  if (attempt.flavourMatched && !attempt.rootMatched) return 'flavour'
  return 'neither'
}

export function missCount(attempts: Attempt[]): number {
  return attempts.filter((attempt) => !attempt.correct).length
}

export function selectFeedback(attempts: Attempt[], solved: boolean): Feedback {
  if (solved) return SOLVED

  const last = attempts[attempts.length - 1]
  if (!last) return OPENING

  return WRONG_GUESS[matchedHalf(last)]
}

export function shouldShowNudge(
  eliminatedCount: number,
  solved: boolean,
  rootConfirmed: boolean,
): boolean {
  return !solved && !rootConfirmed && eliminatedCount > 0
}

export function shouldOfferReveal(
  attempts: Attempt[],
  solved: boolean,
  revealed: boolean,
): boolean {
  return !solved && !revealed && missCount(attempts) >= REVEAL_AFTER_MISSES
}
