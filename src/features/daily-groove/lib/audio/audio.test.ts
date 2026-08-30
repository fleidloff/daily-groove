import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAudioPlayer } from './audio'

type FakeAudio = {
  src: string
  loop: boolean
  currentTime: number
  duration: number
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
  addEventListener: ReturnType<typeof vi.fn>
  removeEventListener: ReturnType<typeof vi.fn>
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
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
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

  // Step C2 / Step D1 — playback loops, but only when the caller asks.
  it('loops the element when asked (R17, AC11)', () => {
    const player = createAudioPlayer('/grooves/x.mp3', { loop: true })
    expect(instances[0].loop).toBe(true)
    player.dispose()
  })

  it('does not loop by default (R17)', () => {
    const player = createAudioPlayer('/grooves/x.mp3')
    expect(instances[0].loop).toBe(false)
    player.dispose()
  })

  it('does not loop when the option is absent or false (R17)', () => {
    const withEmpty = createAudioPlayer('/grooves/x.mp3', {})
    expect(instances[0].loop).toBe(false)
    withEmpty.dispose()

    const withFalse = createAudioPlayer('/grooves/x.mp3', { loop: false })
    expect(instances[1].loop).toBe(false)
    withFalse.dispose()
  })

  // AC11 — the wrap is the element's own, so there is no gap at the loop point.
  it('loops through the element, never by re-triggering on "ended" (R17, AC11)', async () => {
    const player = createAudioPlayer('/grooves/x.mp3', { loop: true })
    const el = instances[0]

    await player.play()
    expect(el.play).toHaveBeenCalledTimes(1)

    // The element reaches the end of the loop and wraps itself.
    el.duration = 12
    el.currentTime = 12
    el.currentTime = 0
    flushFrames(2)

    // Playback carried on with no second play() and no `ended` handler.
    expect(el.play).toHaveBeenCalledTimes(1)
    expect(el.pause).not.toHaveBeenCalled()
    expect(player.isPlaying()).toBe(true)
    // ...and the position has restarted from the top.
    expect(player.getPosition()).toBe(0)

    const endedListeners = el.addEventListener.mock.calls.filter(
      ([event]) => event === 'ended',
    )
    expect(endedListeners).toEqual([])

    player.dispose()
  })

  // AC12 — stopping a looping groove ends it at once and it stays stopped.
  it('stop() halts a looping groove immediately and it does not resume (R17, AC12)', async () => {
    const player = createAudioPlayer('/grooves/x.mp3', { loop: true })
    const el = instances[0]

    await player.play()
    el.duration = 12
    el.currentTime = 6

    player.stop()

    expect(el.pause).toHaveBeenCalledTimes(1)
    expect(player.isPlaying()).toBe(false)

    // Nothing brings it back on its own: no pending frame, no further play().
    flushFrames(3)
    expect(el.play).toHaveBeenCalledTimes(1)
    expect(player.isPlaying()).toBe(false)

    player.dispose()
  })

  // Step B1 — stopping halts playback and returns the loop to its start.
  it('stop() rewinds the loop to the start and stops playing (R6, AC5)', async () => {
    const player = createAudioPlayer('/grooves/x.mp3')
    const el = instances[0]

    await player.play()
    expect(player.isPlaying()).toBe(true)

    el.duration = 12
    el.currentTime = 6
    expect(player.getPosition()).toBe(0.5)

    player.stop()

    expect(el.pause).toHaveBeenCalledTimes(1)
    expect(el.currentTime).toBe(0)
    expect(player.getPosition()).toBe(0)
    expect(player.isPlaying()).toBe(false)

    player.dispose()
  })

  // Step B2 — the next press starts the loop again; it does not resume.
  it('play() restarts from the beginning after a stop (R6, AC5)', async () => {
    const player = createAudioPlayer('/grooves/x.mp3')
    const el = instances[0]

    await player.play()
    el.duration = 12
    el.currentTime = 6
    player.stop()

    // Where the element stands at the moment playback is asked for again.
    let positionAtPlay = -1
    el.play.mockImplementationOnce(async () => {
      positionAtPlay = el.currentTime
    })
    await player.play()

    expect(positionAtPlay).toBe(0)
    expect(el.currentTime).toBe(0)
    expect(el.play).toHaveBeenCalledTimes(2)
    expect(player.isPlaying()).toBe(true)

    player.dispose()
  })

  // Step B3 — a groove left running still repeats until it is stopped.
  it('keeps the element looping across a play/stop/play cycle (R6, AC6)', async () => {
    const player = createAudioPlayer('/grooves/x.mp3', { loop: true })
    const el = instances[0]

    await player.play()
    expect(el.loop).toBe(true)

    el.duration = 12
    el.currentTime = 6
    player.stop()
    expect(el.loop).toBe(true)

    await player.play()
    expect(el.loop).toBe(true)

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
    player.stop()
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

    player.stop()
    expect(frames.size).toBe(0)

    const afterStop = listener.mock.calls.length
    flushFrames()
    expect(listener.mock.calls.length).toBe(afterStop)

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


  // The transport maps elapsed seconds onto the musical loop, which the file's
  // own duration cannot give it — see `loopSecondsOf`.
  it('getCurrentTime() reports elapsed seconds, not a normalised position', () => {
    const player = createAudioPlayer('/grooves/x.mp3', { loop: true })
    const el = instances[0]

    el.duration = 12
    el.currentTime = 3

    expect(player.getCurrentTime()).toBe(3)
    // The normalised reading is a different number, and stays available.
    expect(player.getPosition()).toBeCloseTo(0.25, 6)
  })

  it('getCurrentTime() is 0 before anything has played', () => {
    const player = createAudioPlayer('/grooves/x.mp3', { loop: true })
    expect(player.getCurrentTime()).toBe(0)
  })
})
