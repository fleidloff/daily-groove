import type { Attempt } from '../types'

/**
 * How a feedback message reads, semantically. A tone is a name, never a colour
 * value — the UI maps it to design tokens, and every tone's wording differs on
 * its own so nothing is conveyed by colour alone.
 */
export type FeedbackTone = 'neutral' | 'warm' | 'solved'

/** The line under the check control: what it says, and how it reads. */
export type Feedback = { message: string; tone: FeedbackTone }

/** One dot in the attempt row. */
export type DotState = 'unspent' | 'spent' | 'solved'

/** The dot row marks par, not lives: it is always this wide. */
const DOT_COUNT = 3

/** The nudge appears once this many guesses have missed, and then stays. */
const NUDGE_AFTER_MISSES = 2

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
  message: 'That flavour is close. But the tonic is somewhere else.',
  tone: 'warm',
}

const NEITHER_MATCHED: Feedback = {
  message: 'Not it. No penalty — keep playing and try again.',
  tone: 'warm',
}

/** Which half of a wrong pair was right. */
type MatchedHalf = 'root' | 'flavour' | 'neither'

const WRONG_GUESS: Record<MatchedHalf, Feedback> = {
  root: ROOT_MATCHED,
  flavour: FLAVOUR_MATCHED,
  neither: NEITHER_MATCHED,
}

/**
 * A pair with both halves matched is a solve, so it never reaches here; it
 * falls through to `neither` rather than claiming a half was right.
 */
function matchedHalf(attempt: Attempt): MatchedHalf {
  if (attempt.rootMatched && !attempt.flavourMatched) return 'root'
  if (attempt.flavourMatched && !attempt.rootMatched) return 'flavour'
  return 'neither'
}

/** How many of the attempts so far were misses. */
function missCount(attempts: Attempt[]): number {
  return attempts.filter((attempt) => !attempt.correct).length
}

/**
 * The line under the check control. Solving wins over everything; before any
 * guess it is opening guidance; otherwise it reports which half of the last
 * guessed pair was right.
 */
export function selectFeedback(attempts: Attempt[], solved: boolean): Feedback {
  if (solved) return SOLVED

  const last = attempts[attempts.length - 1]
  if (!last) return OPENING

  return WRONG_GUESS[matchedHalf(last)]
}

/**
 * Whether the nudge revealing the day's root is visible. It appears on the
 * second miss and stays for the rest of the day — no latch needed, the miss
 * count only grows — and is withdrawn once the day is solved.
 */
export function shouldShowNudge(attempts: Attempt[], solved: boolean): boolean {
  return !solved && missCount(attempts) >= NUDGE_AFTER_MISSES
}

/**
 * The three attempt dots. Always exactly three: the row marks par, so a fourth
 * and later miss leaves it full rather than extending it. A solved day turns
 * the whole row.
 */
export function dotStates(attempts: Attempt[], solved: boolean): DotState[] {
  if (solved) return Array<DotState>(DOT_COUNT).fill('solved')

  const spent = Math.min(missCount(attempts), DOT_COUNT)
  return Array.from({ length: DOT_COUNT }, (_, index) =>
    index < spent ? 'spent' : 'unspent',
  )
}
