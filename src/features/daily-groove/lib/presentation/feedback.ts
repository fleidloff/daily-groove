import type { Attempt } from '../../types'

export type FeedbackTone = 'neutral' | 'warm' | 'solved'

export type Feedback = { message: string; tone: FeedbackTone }

export type DotState = 'unspent' | 'spent' | 'solved'

const DOT_COUNT = 3

const NUDGE_AFTER_MISSES = 2

const REVEAL_AFTER_MISSES = 3

const OPENING: Feedback = {
  message:
    'Loop it a few times. Sing the note that feels like rest — that’s usually the root.',
  tone: 'neutral',
}

const SOLVED: Feedback = {
  message: 'That’s it. The groove is yours now — stay in it as long as you like.',
  tone: 'solved',
}

const ROOT_MATCHED: Feedback = {
  message: 'Right home note, wrong colour. Keep the root and try another flavour.',
  tone: 'warm',
}

const FLAVOUR_MATCHED: Feedback = {
  message: 'The mode is right. But the tonic is somewhere else.',
  tone: 'warm',
}

const NEITHER_MATCHED: Feedback = {
  message: 'Not it. Keep playing and try again.',
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

function missCount(attempts: Attempt[]): number {
  return attempts.filter((attempt) => !attempt.correct).length
}

export function selectFeedback(attempts: Attempt[], solved: boolean): Feedback {
  if (solved) return SOLVED

  const last = attempts[attempts.length - 1]
  if (!last) return OPENING

  return WRONG_GUESS[matchedHalf(last)]
}

export function shouldShowNudge(attempts: Attempt[], solved: boolean): boolean {
  return !solved && missCount(attempts) >= NUDGE_AFTER_MISSES
}

export function shouldOfferReveal(
  attempts: Attempt[],
  solved: boolean,
  revealed: boolean,
): boolean {
  return !solved && !revealed && missCount(attempts) >= REVEAL_AFTER_MISSES
}

export function dotStates(attempts: Attempt[], solved: boolean): DotState[] {
  if (solved) return Array<DotState>(DOT_COUNT).fill('solved')

  const spent = Math.min(missCount(attempts), DOT_COUNT)
  return Array.from({ length: DOT_COUNT }, (_, index) =>
    index < spent ? 'spent' : 'unspent',
  )
}
