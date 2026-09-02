import { afterEach, describe, expect, it, vi } from 'vitest'
import { createAudioPlayer } from './audio'
import { hasAudioContext, releaseAudioContext, sharedAudioContext } from './context'
import {
  installFakeAudioContext,
  type FakeContext,
} from '../../testing/fakeAudioContext'

const ONE_SAMPLE = 1 / 44100

const GROOVE_01 = {
  src: '/grooves/groove-01.mp3',
  loopSeconds: 9.142857,
  headDelaySeconds: 0.025057,
}

async function flush() {
  await new Promise((resolve) => {
    setTimeout(resolve, 0)
  })
}

afterEach(async () => {
  await releaseAudioContext()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

describe('installFakeAudioContext', () => {
  it('installs a context the test can drive', () => {
    const fake: FakeContext = installFakeAudioContext({ bufferSeconds: 10 })

    const context = new AudioContext()

    expect(typeof context.decodeAudioData).toBe('function')
    expect(typeof context.createBufferSource).toBe('function')
    expect(context.currentTime).toBe(0)
    expect(context.outputLatency).toBe(0)

    fake.advance(1)
    expect(context.currentTime).toBe(1)
  })

  it('reports the latency it was installed with', () => {
    installFakeAudioContext({ outputLatency: 0.2 })
    expect(new AudioContext().outputLatency).toBe(0.2)
  })
})

describe('createAudioPlayer', () => {
  describe('no context exists until the first press (R6, AC7)', () => {
    it('constructs no AudioContext when the player is built', () => {
      const fake = installFakeAudioContext()

      const player = createAudioPlayer(GROOVE_01)

      expect(fake.contexts).toHaveLength(0)
      player.dispose()
    })

    it('constructs exactly one context on the first load', async () => {
      const fake = installFakeAudioContext()
      const player = createAudioPlayer(GROOVE_01)

      await player.load()

      expect(fake.contexts).toHaveLength(1)
      player.dispose()
    })

    it('constructs no Audio element, ever', async () => {
      const fake = installFakeAudioContext()
      const AudioSpy = vi.fn()
      vi.stubGlobal('Audio', AudioSpy)

      const player = createAudioPlayer(GROOVE_01)
      await player.play()

      expect(AudioSpy).not.toHaveBeenCalled()
      expect(fake.contexts).toHaveLength(1)
      player.dispose()
    })
  })

  describe('the file is decoded once (R10, AC10)', () => {
    it('shares one in-flight decode between concurrent loads', async () => {
      const fake = installFakeAudioContext()
      const player = createAudioPlayer(GROOVE_01)

      await Promise.all([player.load(), player.load(), player.load()])

      expect(fake.decodeCalls).toBe(1)
      expect(fake.fetchCalls).toBe(1)
      player.dispose()
    })

    it('decodes nothing further on a later load', async () => {
      const fake = installFakeAudioContext()
      const player = createAudioPlayer(GROOVE_01)

      await player.load()
      await player.load()

      expect(fake.decodeCalls).toBe(1)
      player.dispose()
    })

    it('starts exactly one source for a press made while decoding', async () => {
      const fake = installFakeAudioContext()
      fake.deferNextDecode()
      const player = createAudioPlayer(GROOVE_01)

      const first = player.play()
      const second = player.play()
      await flush()
      fake.releaseDecodes()
      await Promise.all([first, second])

      expect(fake.decodeCalls).toBe(1)
      expect(fake.sources).toHaveLength(1)
      expect(fake.sources[0].start).toHaveBeenCalledTimes(1)
      player.dispose()
    })
  })

  describe('playing starts one looping source over the musical window (R1, AC1)', () => {
    it('loops the source between the groove’s own boundaries', async () => {
      const fake = installFakeAudioContext({ bufferSeconds: 9.16898 })
      const player = createAudioPlayer(GROOVE_01)

      await player.play()

      expect(fake.sources).toHaveLength(1)
      const [source] = fake.sources
      expect(source.loop).toBe(true)
      expect(source.loopStart).toBeCloseTo(0.025057, 6)
      expect(Math.abs(source.loopEnd - source.loopStart - 9.142857)).toBeLessThan(
        ONE_SAMPLE,
      )
      player.dispose()
    })

    it('starts the source at the head delay and connects it to the output', async () => {
      const fake = installFakeAudioContext({ bufferSeconds: 9.16898 })
      const player = createAudioPlayer(GROOVE_01)

      await player.play()

      const [source] = fake.sources
      expect(source.buffer).toBe(fake.contexts[0].decodedBuffer)
      expect(source.connect).toHaveBeenCalledWith(fake.contexts[0].destination)
      expect(source.start.mock.calls[0][1]).toBeCloseTo(0.025057, 6)
      expect(player.isPlaying()).toBe(true)
      player.dispose()
    })

    it('takes the head delay from the source it was given, not a shared constant', async () => {
      const fake = installFakeAudioContext({ bufferSeconds: 11 })
      const player = createAudioPlayer({
        src: '/grooves/groove-99.mp3',
        loopSeconds: 10,
        headDelaySeconds: 0.05,
      })

      await player.play()

      expect(fake.sources[0].loopStart).toBeCloseTo(0.05, 6)
      player.dispose()
    })
  })

  describe('stopping ends the source and the next press starts a new one (R8, AC9)', () => {
    it('stops the node, and elapsed returns to 0', async () => {
      const fake = installFakeAudioContext()
      const player = createAudioPlayer({ ...GROOVE_01, loopSeconds: 9 })

      await player.play()
      fake.advance(3)
      expect(player.getElapsed()).toBeCloseTo(3, 9)

      player.stop()

      expect(fake.sources[0].stop).toHaveBeenCalledTimes(1)
      expect(player.getElapsed()).toBe(0)
      expect(player.isPlaying()).toBe(false)
      player.dispose()
    })

    it('builds a fresh node on the next press and starts it from the top', async () => {
      const fake = installFakeAudioContext()
      const player = createAudioPlayer({ ...GROOVE_01, loopSeconds: 9 })

      await player.play()
      fake.advance(3)
      player.stop()
      await player.play()

      expect(fake.sources).toHaveLength(2)
      expect(player.getElapsed()).toBe(0)
      expect(player.isPlaying()).toBe(true)
      expect(fake.decodeCalls).toBe(1)
      expect(fake.sources[1].buffer).toBe(fake.sources[0].buffer)
      player.dispose()
    })
  })

  describe('elapsed is the context clock minus the output latency (R3, AC4)', () => {
    it('reads 0 until the first audio has reached the listener', async () => {
      const fake = installFakeAudioContext({ outputLatency: 0.2 })
      const player = createAudioPlayer(GROOVE_01)

      await player.play()
      fake.advance(0.2)

      expect(player.getElapsed()).toBe(0)

      fake.advance(2.5)
      expect(player.getElapsed()).toBeCloseTo(2.5, 9)
      player.dispose()
    })

    it('falls back to baseLatency where that is all the browser reports', async () => {
      const fake = installFakeAudioContext({
        outputLatency: undefined,
        baseLatency: 0.1,
      })
      const player = createAudioPlayer(GROOVE_01)

      await player.play()
      fake.advance(2.6)

      expect(player.getElapsed()).toBeCloseTo(2.5, 9)
      player.dispose()
    })

    it('reads the uncorrected elapsed where no figure is reported (AC4a)', async () => {
      const fake = installFakeAudioContext({
        outputLatency: undefined,
        baseLatency: undefined,
      })
      const player = createAudioPlayer(GROOVE_01)

      await player.play()
      fake.advance(2.5)

      expect(player.getElapsed()).toBeCloseTo(2.5, 9)
      player.dispose()
    })

    it('reads 0 before anything has played', () => {
      installFakeAudioContext()
      const player = createAudioPlayer(GROOVE_01)

      expect(player.getElapsed()).toBe(0)
      player.dispose()
    })
  })

  describe('the start time is the emission clock (R8)', () => {
    it('reports the graph time the source was started at', async () => {
      const fake = installFakeAudioContext()
      const player = createAudioPlayer(GROOVE_01)

      expect(player.getStartTime()).toBeNull()

      fake.advance(3)
      await player.play()

      expect(player.getStartTime()).toBe(3)

      fake.advance(5)
      expect(player.getStartTime()).toBe(3)

      player.stop()
      expect(player.getStartTime()).toBeNull()

      player.dispose()
    })

    it('is not latency-corrected, and getElapsed() still is', async () => {
      const fake = installFakeAudioContext({ outputLatency: 0.2 })
      const player = createAudioPlayer(GROOVE_01)

      fake.advance(1)
      await player.play()
      fake.advance(2)

      const startedAt = player.getStartTime()!
      expect(player.getElapsed()).toBeCloseTo(1.8, 9)
      expect(fake.currentTime - startedAt).toBeCloseTo(2, 9)
      expect(fake.currentTime - startedAt - player.getElapsed()).toBeCloseTo(
        fake.outputLatency!,
        9,
      )

      player.dispose()
    })
  })

  describe('loading is visible while it happens (R7a, AC8b, AC8c)', () => {
    it('is loading between the press and the first sound', async () => {
      const fake = installFakeAudioContext()
      fake.deferNextDecode()
      const player = createAudioPlayer(GROOVE_01)

      const pressed = player.play()
      await flush()

      expect(player.isLoading()).toBe(true)
      expect(player.isPlaying()).toBe(false)

      fake.releaseDecodes()
      await pressed

      expect(player.isLoading()).toBe(false)
      expect(player.isPlaying()).toBe(true)
      player.dispose()
    })

    it('is not loading before a press', () => {
      installFakeAudioContext()
      const player = createAudioPlayer(GROOVE_01)

      expect(player.isLoading()).toBe(false)
      player.dispose()
    })

    it('notifies subscribers when the loading state changes', async () => {
      const fake = installFakeAudioContext()
      fake.deferNextDecode()
      const player = createAudioPlayer(GROOVE_01)
      const listener = vi.fn()
      player.subscribe(listener)

      const pressed = player.play()
      await flush()
      expect(listener).toHaveBeenCalled()

      fake.releaseDecodes()
      await pressed
      player.dispose()
    })
  })

  describe('every failure path raises the same error (R7, AC8, AC8a)', () => {
    it('rejects when the decode fails, and leaves the busy state', async () => {
      const fake = installFakeAudioContext()
      fake.failNextDecode()
      const player = createAudioPlayer(GROOVE_01)

      await expect(player.play()).rejects.toThrow()

      expect(player.isLoading()).toBe(false)
      expect(player.isPlaying()).toBe(false)
      player.dispose()
    })

    it('rejects when the fetch fails, and leaves the busy state', async () => {
      installFakeAudioContext()
      vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
      const player = createAudioPlayer(GROOVE_01)

      await expect(player.play()).rejects.toThrow()

      expect(player.isLoading()).toBe(false)
      expect(player.isPlaying()).toBe(false)
      player.dispose()
    })

    it('rejects rather than throwing where there is no AudioContext (AC8a)', async () => {
      installFakeAudioContext()
      vi.stubGlobal('AudioContext', undefined)
      const player = createAudioPlayer(GROOVE_01)

      let pressed: Promise<void> | null = null
      expect(() => {
        pressed = player.play()
      }).not.toThrow()

      await expect(pressed!).rejects.toThrow()
      expect(player.isLoading()).toBe(false)
      expect(player.isPlaying()).toBe(false)
      player.dispose()
    })

    it('can be retried after a failure', async () => {
      const fake = installFakeAudioContext()
      fake.failNextDecode()
      const player = createAudioPlayer(GROOVE_01)

      await expect(player.play()).rejects.toThrow()
      await player.play()

      expect(player.isPlaying()).toBe(true)
      expect(fake.sources).toHaveLength(1)
      player.dispose()
    })
  })

  describe('lifecycle', () => {
    it('resumes a context the browser handed back suspended', async () => {
      const fake = installFakeAudioContext({ state: 'suspended' })
      const player = createAudioPlayer(GROOVE_01)

      await player.play()

      expect(fake.contexts[0].resume).toHaveBeenCalled()
      expect(fake.contexts[0].state).toBe('running')
      player.dispose()
    })

    it('unsubscribes cleanly', async () => {
      installFakeAudioContext()
      const player = createAudioPlayer(GROOVE_01)
      const listener = vi.fn()
      const unsubscribe = player.subscribe(listener)

      await player.play()
      expect(listener).toHaveBeenCalled()

      unsubscribe()
      const afterUnsubscribe = listener.mock.calls.length
      player.stop()
      expect(listener.mock.calls.length).toBe(afterUnsubscribe)
      player.dispose()
    })

    it('dispose() stops the source and reports nothing playing', async () => {
      const fake = installFakeAudioContext()
      const player = createAudioPlayer(GROOVE_01)

      await player.play()
      player.dispose()

      expect(fake.sources[0].stop).toHaveBeenCalled()
      expect(player.isPlaying()).toBe(false)
      expect(player.getElapsed()).toBe(0)
    })

    it('dispose() does not close the shared context (R16, AC13)', async () => {
      const fake = installFakeAudioContext()
      const player = createAudioPlayer(GROOVE_01)

      await player.play()
      player.dispose()

      expect(fake.contexts[0].close).not.toHaveBeenCalled()
      expect(hasAudioContext()).toBe(true)
      expect(sharedAudioContext()).toBe(fake.contexts[0])
      expect(fake.contexts).toHaveLength(1)
    })

    it('plays through a context another caller built first (R14)', async () => {
      const fake = installFakeAudioContext()
      const shared = sharedAudioContext()
      const player = createAudioPlayer(GROOVE_01)

      await player.play()

      expect(fake.contexts).toHaveLength(1)
      expect(shared).toBe(fake.contexts[0])
      player.dispose()
    })
  })
})
