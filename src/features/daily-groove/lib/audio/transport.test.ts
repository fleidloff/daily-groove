import { afterEach, describe, expect, it, vi } from 'vitest'
import { createPageTransport } from './transport'
import { installFakeAudioContext } from '../../testing/fakeAudioContext'

const TODAY = {
  src: '/grooves/groove-01.mp3',
  loopSeconds: 9.142857,
  headDelaySeconds: 0.025057,
}

const TEN_SECOND_LOOP = {
  src: '/m.mp3',
  loopSeconds: 10,
  headDelaySeconds: 0.025057,
}

async function flush() {
  await new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

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
  it('is built for one source and reports playback as a boolean', async () => {
    const { fake } = install()
    const transport = createPageTransport(TODAY)

    expect(transport.isPlaying()).toBe(false)
    expect(fake.contexts).toHaveLength(0)

    await transport.toggle()

    expect(transport.isPlaying()).toBe(true)
    expect(fake.contexts).toHaveLength(1)
    expect(fake.sources).toHaveLength(1)
    expect(vi.mocked(fetch).mock.calls[0][0]).toBe(TODAY.src)

    transport.dispose()
  })

  it('exposes no groove identifier and no way to supply another source', async () => {
    install()
    const transport = createPageTransport(TODAY)

    expect(Object.keys(transport).sort()).toEqual([
      'dispose',
      'getPosition',
      'getStartTime',
      'isLoading',
      'isPlaying',
      'subscribe',
      'toggle',
    ])
    expect('getSoundingId' in transport).toBe(false)
    expect(transport.toggle).toHaveLength(0)
  })

  it('builds one player, one context and one decode however many times it is toggled', async () => {
    const { fake } = install()
    const transport = createPageTransport(TODAY)

    await transport.toggle()
    await transport.toggle()
    await transport.toggle()

    expect(fake.contexts).toHaveLength(1)
    expect(fake.decodeCalls).toBe(1)
    expect(fake.fetchCalls).toBe(1)
    expect(fake.sources).toHaveLength(2)
    expect(transport.isPlaying()).toBe(true)

    transport.dispose()
  })

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
    expect(fake.contexts[0].close).not.toHaveBeenCalled()
    expect(transport.isPlaying()).toBe(false)

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

    expect(transport.getPosition()).toBeCloseTo(0.375, 6)
    expect(Math.floor(transport.getPosition() * 4)).toBe(1)

    transport.dispose()
  })

  it('wraps at the loop boundary rather than clamping at 1', async () => {
    const { fake } = install({ bufferSeconds: 12 })
    const transport = createPageTransport(TEN_SECOND_LOOP)
    await transport.toggle()

    fake.advance(3.75)
    expect(transport.getPosition()).toBeCloseTo(0.375, 6)

    fake.advance(10)
    expect(transport.getPosition()).toBeCloseTo(0.375, 6)

    fake.advance(10 * 47)
    expect(transport.getPosition()).toBeCloseTo(0.375, 6)

    fake.advance(10 - 3.75)
    expect(transport.getPosition()).toBeCloseTo(0, 6)

    transport.dispose()
  })

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

  it('returns to 0 when the source is stopped', async () => {
    const { fake } = install({ bufferSeconds: 12 })
    const transport = createPageTransport(TEN_SECOND_LOOP)
    await transport.toggle()
    fake.advance(2.5)
    expect(transport.getPosition()).toBeCloseTo(0.25, 6)

    await transport.toggle()
    expect(transport.getPosition()).toBe(0)

    fake.advance(5)
    expect(transport.getPosition()).toBe(0)

    transport.dispose()
  })

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

describe('a failed press (R7, AC8, AC8d)', () => {
  it('rolls back and rethrows when the decode fails', async () => {
    const { fake } = install()
    fake.failNextDecode()
    const transport = createPageTransport(TODAY)

    await expect(transport.toggle()).rejects.toThrow(/decode/i)

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
    expect(fake.contexts).toHaveLength(1)
    expect(fake.decodeCalls).toBe(2)

    transport.dispose()
  })
})

describe('the beat grid’s clock (R8)', () => {
  it('reports nothing before any press', () => {
    const { fake } = install()
    const transport = createPageTransport(TEN_SECOND_LOOP)

    expect(transport.getStartTime()).toBeNull()
    expect(fake.contexts).toHaveLength(0)

    transport.dispose()
  })

  it('reports the graph time the source started at', async () => {
    const { fake } = install({ bufferSeconds: 12 })
    const transport = createPageTransport(TEN_SECOND_LOOP)

    fake.advance(2)
    await transport.toggle()

    expect(transport.getStartTime()).toBe(2)
    expect(Number.isFinite(transport.getStartTime())).toBe(true)

    fake.advance(3.5)
    expect(transport.getStartTime()).toBe(2)

    transport.dispose()
  })

  it('reports nothing once the loop is stopped, and a new time on a restart', async () => {
    const { fake } = install({ bufferSeconds: 12 })
    const transport = createPageTransport(TEN_SECOND_LOOP)

    fake.advance(2)
    await transport.toggle()
    const first = transport.getStartTime()
    expect(first).toBe(2)

    await transport.toggle()
    expect(transport.getStartTime()).toBeNull()

    fake.advance(5)
    await transport.toggle()
    const second = transport.getStartTime()
    expect(second).toBe(7)
    expect(second!).toBeGreaterThan(first!)

    transport.dispose()
  })

  it('reports nothing while the press is still loading', async () => {
    const { fake } = install({ bufferSeconds: 12 })
    fake.deferNextDecode()
    const transport = createPageTransport(TEN_SECOND_LOOP)

    fake.advance(1)
    const pressed = transport.toggle()
    await flush()

    expect(transport.isPlaying()).toBe(true)
    expect(transport.isLoading()).toBe(true)
    expect(transport.getStartTime()).toBeNull()

    fake.releaseDecodes()
    await pressed

    expect(transport.getStartTime()).toBe(1)

    transport.dispose()
  })

  it('is the emission clock, not the latency-corrected one', async () => {
    const { fake } = install({ bufferSeconds: 12, outputLatency: 0.2 })
    const transport = createPageTransport(TEN_SECOND_LOOP)

    await transport.toggle()
    fake.advance(2)

    expect(transport.getPosition()).toBeCloseTo(1.8 / 10, 6)
    expect(fake.currentTime - transport.getStartTime()!).toBeCloseTo(2, 9)

    transport.dispose()
  })
})
