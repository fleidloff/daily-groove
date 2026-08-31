import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  hasAudioContext,
  releaseAudioContext,
  sharedAudioContext,
} from './context'
import { installFakeAudioContext } from '../../testing/fakeAudioContext'

/**
 * The context is a module-level singleton, so every test here has to hand it
 * back: `releaseAudioContext()` is the only reason that function exists.
 */
afterEach(async () => {
  await releaseAudioContext()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

// Step C1 — R14, R15, AC12: one context, built on first use and not before.
describe('sharedAudioContext', () => {
  it('constructs nothing until it is asked for one (R15, AC12)', () => {
    const fake = installFakeAudioContext()

    expect(hasAudioContext()).toBe(false)
    expect(fake.contexts).toHaveLength(0)
  })

  it('constructs exactly one context, however many callers ask (R14)', () => {
    const fake = installFakeAudioContext()

    const first = sharedAudioContext()
    const second = sharedAudioContext()

    expect(second).toBe(first)
    expect(fake.contexts).toHaveLength(1)
    expect(hasAudioContext()).toBe(true)
  })

  it('throws where the browser has no Web Audio, exactly as the player did', () => {
    installFakeAudioContext()
    vi.stubGlobal('AudioContext', undefined)

    expect(() => sharedAudioContext()).toThrow(
      'Audio playback is unavailable in this browser',
    )
    expect(hasAudioContext()).toBe(false)
  })
})

describe('releaseAudioContext', () => {
  it('closes the context and forgets it', async () => {
    const fake = installFakeAudioContext()
    sharedAudioContext()

    await releaseAudioContext()

    expect(fake.contexts[0].close).toHaveBeenCalledTimes(1)
    expect(hasAudioContext()).toBe(false)
  })

  it('resolves when nothing was ever constructed', async () => {
    installFakeAudioContext()

    await expect(releaseAudioContext()).resolves.toBeUndefined()
    expect(hasAudioContext()).toBe(false)
  })

  it('lets the next call build a fresh one', async () => {
    const fake = installFakeAudioContext()

    const first = sharedAudioContext()
    await releaseAudioContext()
    const second = sharedAudioContext()

    expect(second).not.toBe(first)
    expect(fake.contexts).toHaveLength(2)
  })
})
