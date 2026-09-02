import type { Answer, Attempt } from '../../types'
import { FAMILIES } from '../theory/families'
import { degreeDifferences, type DegreeDifference } from '../theory/difference'
import { FLAVOUR_INTERVALS } from '../theory/notes'

const NOTE_COUNT: Record<number, string> = {
  1: 'one note',
  2: 'two notes',
}

function lastIncorrect(attempts: Attempt[]): Attempt | undefined {
  for (let index = attempts.length - 1; index >= 0; index -= 1) {
    if (!attempts[index].correct) return attempts[index]
  }
  return undefined
}

function comparable(flavour: string): boolean {
  const wanted = flavour.trim().toLowerCase()
  return Object.keys(FLAVOUR_INTERVALS).some((key) => key.toLowerCase() === wanted)
}

function spell(differences: DegreeDifference[], side: 'guess' | 'answer'): string {
  return differences.flatMap((difference) => difference[side]).join(' and ')
}

export function selectNearMiss(
  attempts: Attempt[],
  answer: Answer,
  revealed: boolean,
): string | undefined {
  if (!revealed) return undefined

  const attempt = lastIncorrect(attempts)
  if (!attempt) return undefined

  if (FAMILIES.some((family) => family === attempt.flavour)) return undefined

  if (attempt.flavourMatched) {
    return `You said ${attempt.flavour} — the colour was right, not the home note.`
  }

  if (!comparable(attempt.flavour) || !comparable(answer.flavour)) return undefined

  const differences = degreeDifferences(attempt.flavour, answer.flavour)
  if (differences.length === 0) return undefined
  const spoken = NOTE_COUNT[differences.length]

  const spellable = differences.every(
    (difference) => difference.guess.length === 1 && difference.answer.length === 1,
  )
  if (spoken === undefined || !spellable) {
    return `You said ${attempt.flavour} — a long way from this one, not a near miss.`
  }

  const guessed = spell(differences, 'guess')
  const answered = spell(differences, 'answer')
  return `You said ${attempt.flavour} — ${spoken} apart: ${guessed}, not ${answered}.`
}
