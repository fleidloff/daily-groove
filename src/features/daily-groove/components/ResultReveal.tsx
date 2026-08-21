'use client'

type ResultRevealProps = {
  correct: boolean
  answer: string
}

/**
 * Reveals the outcome of a submitted guess: whether it was correct, and always
 * the correct answer.
 */
export function ResultReveal({ correct, answer }: ResultRevealProps) {
  return (
    <div role="status">
      <p>{correct ? 'Correct!' : 'Incorrect'}</p>
      <p>
        The scale was <strong>{answer}</strong>
      </p>
    </div>
  )
}
