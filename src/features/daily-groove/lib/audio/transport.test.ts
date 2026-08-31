import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPageTransport } from './transport'
import { installFakeAudioContext } from '../../testing/fakeAudioContext'

/**
 * The transport is driven through the *real* player against a fake
 * `AudioContext`, not against a hand-made stand-in for the player.
 *
 * Position is now arithmetic over a clock, and a fake player that reports its
 * own elapsed time would only prove the transport can divide. The fake context
 * gives the tests the clock itself: "one loop later" is `advance(10)`, exactly,
 * and the assertions run over the same code path the browser runs.
 */

/** groove-01: 4 bars at 105bpm, in a file with 25ms of encoder delay. */
const TODAY = {
  src: '/grooves/groove-01.mp3',
  loopSeconds: 9.142857,
  headDelaySeconds: 0.025057,
}

/** A round loop, so a position reads as a fraction anyone can check by eye. */
const TEN_SECOND_LOOP = {
  src: '/m.mp3',
  loopSeconds: 10,
  headDelaySeconds: 0.025057,
}

/**
 * Drain the microtask queue, so a press has reached the decode it is waiting
 * on. A macrotask turn rather than a counted number of `Promise.resolve()`s:
 * the fetch-then-arrayBuffer-then-decode chain is several ticks long.
 */
async function flush() {
  await new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

/**
 * A hand-driven `requestAnimationFrame`, so the player's position poll fires
 * only when a test says so. Without it the poll would notify on jsdom's own
 * 16ms timer, and "did the transport forward a notification" would become a
 * question about wall-clock time.
 */
function installFrames() {
  const pending = new Map<number, FrameRequestCallback>()
  let nextId = 1

  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    const id = nextId
    nextId += 1
    pending.set(id, fn)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    pending.delete(id)
  })

  return function frame() {
    const due = Array.from(pending.entries())
    pending.clear()
    for (const [, fn] of due) fn(0)
  }
}

/** The fake context plus the hand-driven frame loop, installed together. */
function install(opts?: Parameters<typeof installFakeAudioContext>[0]) {
  const frame = installFrames()
  const fake = installFakeAudioContext(opts)
  return { fake, frame }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('createPageTransport', () => {
  // Step D1 — R5, R6, AC7
  it('is built for one source and reports playback as a boolean', async () => {
    const { fake } = install()
    const transport = createPageTransport(TODAY)

    expect(transport.isPlaying()).toBe(false)
    // Nothing touches the audio hardware until the first press.
    expect(fake.contexts).toHaveLength(0)

    await transport.toggle()

    expect(transport.isPlaying()).toBe(true)
    expect(fake.contexts).toHaveLength(1)
    expect(fake.sources).toHaveLength(1)
    // The file it fetched is the one source it was built for.
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(TODAY.src)

    transport.dispose()
  })

  // Step D1 — R5, R6: the surface names no groove and accepts none.
  it('exposes no groove identifier and no way to supply another source', async () => {
    install()
    const transport = createPageTransport(TODAY)

    expect(Object.keys(transport).sort()).toEqual([
      'dispose',
      'getPosition',
      'isLoading',
      'isPlaying',
      'subscribe',
      'toggle',
    ])
    expect('getSoundingId' in transport).toBe(false)
    // `toggle` declares no parameter, so no caller can point it elsewhere.
    expect(transport.toggle).toHaveLength(0)
  })

  // Step D1 — R6, R10, AC10
  it('builds one player, one context and one decode however many times it is toggled', async () => {
    const { fake } = install()
    const transport = createPageTransport(TODAY)

    await transport.toggle()
    await transport.toggle()
    await transport.toggle()

    expect(fake.contexts).toHaveLength(1)
    // The decoded buffer is kept, so only the first press pays for it.
    expect(fake.decodeCalls).toBe(1)
    expect(fake.fetchCalls).toBe(1)
    // A buffer source is single-use, so the restart is a second node over the
    // same buffer — not a second player, and not a second decode.
    expect(fake.sources).toHaveLength(2)
    expect(transport.isPlaying()).toBe(true)

    transport.dispose()
  })

  // Step D1 — R5, R8
  it('stops and rewinds when it is toggled while running', async () => {
    const { fake } = install()
    const transport = createPageTransport(TODAY)

    await transport.toggle()
    fake.advance(3)
    await transport.toggle()

    expect(transport.isPlaying()).toBe(false)
    expect(fake.sources[0].stop).toHaveBeenCalledTimes(1)
    expect(transport.getPosition()).toBe(0)

    transport.dispose()
  })

  it('disposes the player, clears listeners and goes silent', async () => {
    const { fake, frame } = install()
    const transport = createPageTransport(TODAY)
    const listener = vi.fn()
    transport.subscribe(listener)

    await transport.toggle()
    listener.mockClear()

    transport.dispose()

    expect(fake.sources[0].stop).toHaveBeenCalled()
    // The context is *not* closed: it belongs to the page, and the reference
    // note a root chip sounds shares it (R16, AC13).
    expect(fake.contexts[0].close).not.toHaveBeenCalled()
    expect(transport.isPlaying()).toBe(false)

    // The listener set is empty: a late notification reaches nobody.
    frame()
    expect(listener).not.toHaveBeenCalled()
  })

  it('is inert after disposal', () => {
    install()
    const transport = createPageTransport(TODAY)

    transport.dispose()

    expect(transport.isPlaying()).toBe(false)
    expect(transport.isLoading()).toBe(false)
    expect(transport.getPosition()).toBe(0)
  })

  describe('subscribe', () => {
    it('forwards the player’s notifications', async () => {
      const { frame } = install()
      const transport = createPageTransport(TODAY)
      const listener = vi.fn()
      transport.subscribe(listener)

      await transport.toggle()
      expect(listener).toHaveBeenCalled()

      // Each frame of the position poll is a notification the page needs, or
      // `useSyncExternalStore` would never re-read a moving position.
      listener.mockClear()
      frame()
      expect(listener).toHaveBeenCalledTimes(1)

      transport.dispose()
    })

    it('returns an unsubscribe that stops the notifications', async () => {
      const { frame } = install()
      const transport = createPageTransport(TODAY)
      const listener = vi.fn()
      const unsubscribe = transport.subscribe(listener)

      await transport.toggle()
      unsubscribe()
      listener.mockClear()

      frame()
      expect(listener).not.toHaveBeenCalled()

      transport.dispose()
    })

    it('notifies on start and on stop', async () => {
      install()
      const transport = createPageTransport(TODAY)
      const listener = vi.fn()
      transport.subscribe(listener)

      await transport.toggle()
      expect(listener).toHaveBeenCalled()

      listener.mockClear()
      await transport.toggle()
      expect(listener).toHaveBeenCalled()

      transport.dispose()
    })
  })
})

/**
 * Step D1 — R7a, AC8b, AC8c. Web Audio has no progressive playback: the press
 * and the first sound are separated by a fetch and a decode, and the control
 * has to be able to say so rather than sitting in "Stop" over silence.
 */
describe('the busy state (R7a, AC8b, AC8c)', () => {
  it('is not loading before a press', () => {
    install()
    const transport = createPageTransport(TODAY)

    expect(transport.isLoading()).toBe(false)
    expect(transport.isPlaying()).toBe(false)
  })

  it('is loading while the decode is pending, and not once it sounds', async () => {
    const { fake } = install()
    fake.deferNextDecode()
    const transport = createPageTransport(TODAY)

    const pressed = transport.toggle()
    await flush()

    expect(transport.isLoading()).toBe(true)
    expect(fake.sources).toHaveLength(0)

    fake.releaseDecodes()
    await pressed

    expect(transport.isLoading()).toBe(false)
    expect(transport.isPlaying()).toBe(true)

    transport.dispose()
  })

  it('is not loading again on the press that stops it', async () => {
    install()
    const transport = createPageTransport(TODAY)

    await transport.toggle()
    await transport.toggle()

    expect(transport.isLoading()).toBe(false)
    expect(transport.isPlaying()).toBe(false)

    transport.dispose()
  })
})

/**
 * Step D2 — R2, R5, AC2, AC3, AC6.
 *
 * The bar highlight is drawn by quartering `getPosition()`, so the number has
 * to describe the *music*: elapsed seconds on the graph's own clock, mapped
 * onto the loop length the transport was constructed with. It wraps rather than
 * clamping, because the position is derived on every read instead of counted
 * forward — the fiftieth repeat reads exactly like the first.
 */
describe('musical position (R2, R5)', () => {
  it('is 0 while nothing plays, and touches no context', () => {
    const { fake } = install()
    const transport = createPageTransport(TEN_SECOND_LOOP)

    expect(transport.getPosition()).toBe(0)
    expect(fake.contexts).toHaveLength(0)
  })

  it('is the elapsed fraction of the loop, off the audio clock', async () => {
    const { fake } = install({ bufferSeconds: 12 })
    const transport = createPageTransport(TEN_SECOND_LOOP)
    await transport.toggle()

    fake.advance(3.75)

    // Three eighths of the loop — which quarters into bar 2 (AC3).
    expect(transport.getPosition()).toBeCloseTo(0.375, 6)
    expect(Math.floor(transport.getPosition() * 4)).toBe(1)

    transport.dispose()
  })

  // AC2: past one full loop the position wraps to near zero, not to a clamp.
  it('wraps at the loop boundary rather than clamping at 1', async () => {
    const { fake } = install({ bufferSeconds: 12 })
    const transport = createPageTransport(TEN_SECOND_LOOP)
    await transport.toggle()

    fake.advance(3.75)
    expect(transport.getPosition()).toBeCloseTo(0.375, 6)

    // One whole loop later, the same point in the bar.
    fake.advance(10)
    expect(transport.getPosition()).toBeCloseTo(0.375, 6)

    // ...and on the fiftieth repeat too.
    fake.advance(10 * 47)
    expect(transport.getPosition()).toBeCloseTo(0.375, 6)

    // Exactly on the boundary it reads the top of the loop, never 1.
    fake.advance(10 - 3.75)
    expect(transport.getPosition()).toBeCloseTo(0, 6)

    transport.dispose()
  })

  // R3 reaches the page through here: the correction is the player's, and the
  // transport must not undo it by counting from the press instead.
  it('reads 0 until the first audio has reached the listener', async () => {
    const { fake } = install({ bufferSeconds: 12, outputLatency: 0.2 })
    const transport = createPageTransport(TEN_SECOND_LOOP)
    await transport.toggle()

    fake.advance(0.2)
    expect(transport.getPosition()).toBe(0)

    fake.advance(2.5)
    expect(transport.getPosition()).toBeCloseTo(0.25, 6)

    transport.dispose()
  })

  // AC6 — nothing is held: a stop returns the number to zero at once.
  it('returns to 0 when the source is stopped', async () => {
    const { fake } = install({ bufferSeconds: 12 })
    const transport = createPageTransport(TEN_SECOND_LOOP)
    await transport.toggle()
    fake.advance(2.5)
    expect(transport.getPosition()).toBeCloseTo(0.25, 6)

    await transport.toggle()
    expect(transport.getPosition()).toBe(0)

    // ...and the clock running on does not revive it.
    fake.advance(5)
    expect(transport.getPosition()).toBe(0)

    transport.dispose()
  })

  // AC9 — the next press begins at bar 1, not where the last one stopped.
  it('starts the next press from the top', async () => {
    const { fake } = install({ bufferSeconds: 12 })
    const transport = createPageTransport(TEN_SECOND_LOOP)

    await transport.toggle()
    fake.advance(7.5)
    await transport.toggle()

    fake.advance(1)
    await transport.toggle()
    expect(transport.getPosition()).toBe(0)

    fake.advance(2.5)
    expect(transport.getPosition()).toBeCloseTo(0.25, 6)

    transport.dispose()
  })

  // `loopSecondsOf` returns 0 for a groove with a nonsensical bpm, so a
  // zero-length loop is reachable without any caller doing anything odd. There
  // is no file position to fall back on any more — the player reports elapsed
  // seconds, and a loop of no length maps them nowhere.
  it('is 0 when the loop length is unusable', async () => {
    const { fake } = install()
    const transport = createPageTransport({
      src: '/m.mp3',
      loopSeconds: 0,
      headDelaySeconds: 0.025057,
    })
    await transport.toggle()

    fake.advance(999)
    expect(transport.getPosition()).toBe(0)

    transport.dispose()
  })
})

/**
 * Step D3 — R7, AC8, AC8d. Every way a press can fail lands in the same place:
 * the transport rolls back, clears the busy state and rethrows, so the page
 * raises the one error state with its retry affordance.
 */
describe('a failed press (R7, AC8, AC8d)', () => {
  it('rolls back and rethrows when the decode fails', async () => {
    const { fake } = install()
    fake.failNextDecode()
    const transport = createPageTransport(TODAY)

    await expect(transport.toggle()).rejects.toThrow(/decode/i)

    // Nothing sounds, so no control is left showing a stop affordance for a
    // groove that never started — and none is left showing a wait either.
    expect(transport.isPlaying()).toBe(false)
    expect(transport.isLoading()).toBe(false)
    expect(fake.sources).toHaveLength(0)

    transport.dispose()
  })

  it('rolls back and rethrows when the fetch fails', async () => {
    install()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new Error('network down')
      }),
    )
    const transport = createPageTransport(TODAY)

    await expect(transport.toggle()).rejects.toThrow('network down')

    expect(transport.isPlaying()).toBe(false)
    expect(transport.isLoading()).toBe(false)

    transport.dispose()
  })

  it('rejects rather than throwing where there is no AudioContext', async () => {
    install()
    vi.stubGlobal('AudioContext', undefined)
    const transport = createPageTransport(TODAY)

    // The press itself must not throw synchronously: the page awaits it.
    const pressed = transport.toggle()
    await expect(pressed).rejects.toThrow(/unavailable/i)

    expect(transport.isPlaying()).toBe(false)
    expect(transport.isLoading()).toBe(false)

    transport.dispose()
  })

  it('leaves the transport usable for the next press', async () => {
    const { fake } = install()
    fake.failNextDecode()
    const transport = createPageTransport(TODAY)

    await expect(transport.toggle()).rejects.toThrow(/decode/i)

    await transport.toggle()

    expect(transport.isPlaying()).toBe(true)
    expect(fake.sources).toHaveLength(1)
    // The failed press did not cost a player: the retry reused the context.
    expect(fake.contexts).toHaveLength(1)
    expect(fake.decodeCalls).toBe(2)

    transport.dispose()
  })
})
