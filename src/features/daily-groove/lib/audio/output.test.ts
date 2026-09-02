import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
  type OutputClaim,
  referenceOutput,
  resetReferenceOutput,
} from './output'

beforeEach(() => {
  resetReferenceOutput()
})

describe('claiming the reference output (R10, R10a, AC8)', () => {
  it('cancels the current holder and never the arriving sound', () => {
    const cancelLick = vi.fn()
    const cancelRoot = vi.fn()

    const lick = referenceOutput().claim(cancelLick)
    const root = referenceOutput().claim(cancelRoot)

    expect(cancelLick).toHaveBeenCalledTimes(1)
    expect(cancelRoot).not.toHaveBeenCalled()
    expect(lick.isHeld()).toBe(false)
    expect(root.isHeld()).toBe(true)
  })

  it('cancels each holder in turn, so at most one sound is ever live', () => {
    const cancelLick = vi.fn()
    const cancelRoot = vi.fn()
    const cancelNextRoot = vi.fn()

    referenceOutput().claim(cancelLick)
    referenceOutput().claim(cancelRoot)
    const third = referenceOutput().claim(cancelNextRoot)

    expect(cancelRoot).toHaveBeenCalledTimes(1)
    expect(cancelLick).toHaveBeenCalledTimes(1)
    expect(cancelNextRoot).not.toHaveBeenCalled()
    expect(third.isHeld()).toBe(true)
  })
})

describe('a cancel that releases its own claim (R10b)', () => {
  it('does not evict its successor', () => {
    let first: OutputClaim | null = null
    first = referenceOutput().claim(() => first?.release())

    const second = referenceOutput().claim(vi.fn())

    expect(referenceOutput().isClaimed()).toBe(true)
    expect(second.isHeld()).toBe(true)
  })
})

describe('releasing the reference output (R10b)', () => {
  it('frees it, and a voluntary release is not a cancellation', () => {
    const cancel = vi.fn()
    const claim = referenceOutput().claim(cancel)

    claim.release()

    expect(referenceOutput().isClaimed()).toBe(false)
    expect(claim.isHeld()).toBe(false)

    expect(() => {
      claim.release()
      claim.release()
    }).not.toThrow()
    expect(cancel).not.toHaveBeenCalled()
  })

  it('is a no-op once the claim has been superseded', () => {
    const first = referenceOutput().claim(vi.fn())
    const second = referenceOutput().claim(vi.fn())

    first.release()

    expect(second.isHeld()).toBe(true)
    expect(referenceOutput().isClaimed()).toBe(true)
  })

  it('forgets the holder on reset without cancelling it', () => {
    const cancel = vi.fn()
    referenceOutput().claim(cancel)

    resetReferenceOutput()

    expect(referenceOutput().isClaimed()).toBe(false)
    expect(cancel).not.toHaveBeenCalled()
  })
})
