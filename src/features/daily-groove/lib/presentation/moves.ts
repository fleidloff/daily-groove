import { coaching } from '@/lib/snippets'

export type Move = {
  message: string
  soundsOff?: string
}

export const LADDER: readonly [Move, Move, Move, Move] = coaching.ladder
