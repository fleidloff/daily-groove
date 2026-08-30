import { act, render } from '@testing-library/react'
import { GroovePuzzle } from '../components/GroovePuzzle'

/**
 * Test support for the assertions that only hold when the whole feature is
 * composed. It is what `src/app/page.test.tsx` used to do inline, lifted into
 * the feature so the assertions relocated out of the route keep the render they
 * were written against (Epic 3, Step C2).
 *
 * It lives inside the feature, so deleting the feature deletes it (R11).
 *
 * Callers whose assertions press a play control must mock the feature's audio
 * module themselves — `vi.mock` is hoisted per test file and cannot be shared
 * from here. The transport builds its player lazily, so a render that never
 * presses anything needs no mock at all.
 */

/**
 * Flush the store reads and the hydration effect they gate. The puzzle reads
 * the day's saved record through a promise-returning store before it paints a
 * game, so every composed assertion lets that settle first.
 */
export async function settleFeature() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

/**
 * Render the feature as the route composes it — no groove prop, so it resolves
 * today's groove on the client exactly as the page does — and settle it.
 */
export async function renderFeature() {
  const result = render(<GroovePuzzle />)
  await settleFeature()
  return result
}
