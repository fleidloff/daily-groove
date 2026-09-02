import type { Attempt } from '../../types'

export function shouldShowVerdict(attempts: readonly Attempt[]): boolean {
  const last = attempts[attempts.length - 1]
  if (!last || last.correct) return false

  const earlier = attempts.slice(0, -1).filter((attempt) => !attempt.correct)
  if (earlier.length === 0) return true

  return (
    (Boolean(last.rootMatched) && !earlier.some((a) => a.rootMatched)) ||
    (Boolean(last.flavourMatched) && !earlier.some((a) => a.flavourMatched))
  )
}
