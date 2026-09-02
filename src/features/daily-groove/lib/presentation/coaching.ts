import type { Attempt } from '../../types'
import type { Feedback } from './feedback'
import type { CoachingFamily } from './coachingFamily'
import { coachingPosition } from './coachingFamily'
import type { Move } from './moves'
import { LADDER } from './moves'
import { COLOUR_MOVES, SIMPLE_COLOUR_MOVES, TONIC_MOVES } from './coachingMoves'

export type CoachingInput = {
  attempts: readonly Attempt[]
  tapSounds: boolean
  simple: boolean
}

function tableFor(family: CoachingFamily, simple: boolean): readonly Move[] {
  if (family === 'colour') return simple ? SIMPLE_COLOUR_MOVES : COLOUR_MOVES
  if (family === 'tonic') return TONIC_MOVES
  return LADDER
}

export function selectCoaching({
  attempts,
  tapSounds,
  simple,
}: CoachingInput): Feedback {
  const { family, index } = coachingPosition(attempts)
  const table = tableFor(family, simple)
  const move = table[Math.min(index, table.length - 1)]

  return {
    message: tapSounds ? move.message : (move.soundsOff ?? move.message),
    tone: 'neutral',
  }
}
