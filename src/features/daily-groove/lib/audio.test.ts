import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAudioPlayer } from './audio'

type FakeAudio = {
  src: string
  loop: boolean
  currentTime: number
  duration: number
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
}

let instances: FakeAudio[]
let AudioSpy: ReturnType<typeof vi.fn>

// jsdom implements no real playback, so the element is stubbed and the
// animation-frame loop is driven by hand.
let frames: Map<number, FrameRequestCallback>
let nextFrameId: number

function flushFrames(times = 1) {
  for (let i = 0; i < times; i++) {
    const pending = Array.from(frames.entries())
    frames.clear()
    for (const [, cb] of pending) cb(performance.now())
  }
}

beforeEach(() => {
  instances = []
  frames = new Map()
  nextFrameId = 1

  AudioSpy = vi.fn(function (this: FakeAudio, src?: string) {
    const el: FakeAudio = {
      src: src ?? '',
      loop: false,
      currentTime: 0,
      duration: NaN,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    }
    instances.push(el)
    return el
  })
  vi.stubGlobal('Audio', AudioSpy)

  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
    const id = nextFrameId++
    frames.set(id, cb)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    frames.delete(id)
  })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('createAudioPlayer', () => {
  it('constructs an Audio element with the given src', () => {
    createAudioPlayer('/grooves/x.mp3')
    expect(AudioSpy).toHaveBeenCalledTimes(1)
    expect(instances[0].src).toBe('/grooves/x.mp3')
  })

  it('play() calls the element play()', async () => {
    const player = createAudioPlayer('/grooves/x.mp3')
    await player.play()
    expect(instances[0].play).toHaveBeenCalledTimes(1)
    player.dispose()
  })

  // Step C2 — playback loops.
  it('loops the element', () => {
    const player = createAudioPlayer('/grooves/x.mp3')
    expect(instances[0].loop).toBe(true)
    player.dispose()
  })

  // Step C3 — pause holds position and play resumes.
  it('pause() holds the position and stops playing', async () => {
    const player = createAudioPlayer('/grooves/x.mp3')
    const el = instances[0]

    await player.play()
    expect(player.isPlaying()).toBe(true)

    el.currentTime = 4.2
    player.pause()

    expect(el.pause).toHaveBeenCalledTimes(1)
    expect(el.currentTime).toBe(4.2)
    expect(player.isPlaying()).toBe(false)

    player.dispose()
  })

  it('play() resumes from the held position rather than restarting', async () => {
    const player = createAudioPlayer('/grooves/x.mp3')
    const el = instances[0]

    await player.play()
    el.currentTime = 4.2
    player.pause()
    await player.play()

    expect(el.currentTime).toBe(4.2)
    expect(el.play).toHaveBeenCalledTimes(2)
    expect(player.isPlaying()).toBe(true)

    player.dispose()
  })

  // Step C4 — position is observable.
  it('getPosition() is 0 before playing', () => {
    const player = createAudioPlayer('/grooves/x.mp3')
    expect(player.getPosition()).toBe(0)
    player.dispose()
  })

  it('getPosition() is currentTime over duration', async () => {
    const player = createAudioPlayer('/grooves/x.mp3')
    const el = instances[0]

    await player.play()
    el.duration = 12
    el.currentTime = 3

    expect(player.getPosition()).toBe(0.25)
    player.dispose()
  })

  it('getPosition() is guarded against a zero or NaN duration', async () => {
    const player = createAudioPlayer('/grooves/x.mp3')
    const el = instances[0]

    await player.play()
    el.currentTime = 3

    el.duration = 0
    expect(player.getPosition()).toBe(0)

    el.duration = NaN
    expect(player.getPosition()).toBe(0)

    el.duration = Infinity
    expect(player.getPosition()).toBe(0)

    player.dispose()
  })

  it('subscribe() returns an unsubscribe that stops further notification', async () => {
    const player = createAudioPlayer('/grooves/x.mp3')
    const listener = vi.fn()
    const unsubscribe = player.subscribe(listener)

    await player.play()
    expect(listener).toHaveBeenCalled()

    const afterPlay = listener.mock.calls.length
    flushFrames()
    expect(listener.mock.calls.length).toBeGreaterThan(afterPlay)

    unsubscribe()
    const afterUnsubscribe = listener.mock.calls.length
    flushFrames()
    player.pause()
    expect(listener.mock.calls.length).toBe(afterUnsubscribe)

    player.dispose()
  })

  it('polls position with requestAnimationFrame only while playing', async () => {
    const player = createAudioPlayer('/grooves/x.mp3')
    const listener = vi.fn()
    player.subscribe(listener)

    expect(frames.size).toBe(0)

    await player.play()
    expect(frames.size).toBe(1)

    flushFrames(3)
    expect(frames.size).toBe(1)

    player.pause()
    expect(frames.size).toBe(0)

    const afterPause = listener.mock.calls.length
    flushFrames()
    expect(listener.mock.calls.length).toBe(afterPause)

    player.dispose()
  })

  it('dispose() stops the animation loop and leaves nothing pending', async () => {
    const player = createAudioPlayer('/grooves/x.mp3')
    await player.play()
    expect(frames.size).toBe(1)

    player.dispose()

    expect(frames.size).toBe(0)
    expect(player.isPlaying()).toBe(false)
    expect(instances[0].pause).toHaveBeenCalled()
  })

  // Step C5 — a failed play still rejects.
  it('play() rejects when the element play promise rejects', async () => {
    const player = createAudioPlayer('/grooves/x.mp3')
    const failure = new Error('play failed')
    instances[0].play.mockRejectedValueOnce(failure)

    await expect(player.play()).rejects.toBe(failure)
    expect(player.isPlaying()).toBe(false)
    expect(frames.size).toBe(0)

    player.dispose()
  })
})
