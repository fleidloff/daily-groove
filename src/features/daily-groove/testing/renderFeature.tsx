import { act, render } from '@testing-library/react'
import { GroovePuzzle } from '../components/GroovePuzzle'

export async function settleFeature() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

export async function renderFeature() {
  const result = render(<GroovePuzzle />)
  await settleFeature()
  return result
}
