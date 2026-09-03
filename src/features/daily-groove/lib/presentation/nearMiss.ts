import { coaching } from '@/lib/snippets'
import type { Answer, Attempt } from '../../types'
import { FAMILIES } from '@/lib/theory/families'
import { degreeDifferences, type DegreeDifference } from '@/lib/theory/difference'
import { FLAVOUR_INTERVALS } from '@/lib/theory/scales'

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
    return coaching.nearMissColourRight({ flavour: attempt.flavour })
  }

  if (!comparable(attempt.flavour) || !comparable(answer.flavour)) return undefined

  const differences = degreeDifferences(attempt.flavour, answer.flavour)
  if (differences.length === 0) return undefined

  const spellable = differences.every(
    (difference) => difference.guess.length === 1 && difference.answer.length === 1,
  )
  if (differences.length > 2 || !spellable) {
    return coaching.nearMissFar({ flavour: attempt.flavour })
  }

  return coaching.nearMissApart({
    flavour: attempt.flavour,
    notes: differences.length as 1 | 2,
    guessed: spell(differences, 'guess'),
    answered: spell(differences, 'answer'),
  })
}
