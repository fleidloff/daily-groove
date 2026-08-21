import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createAudioPlayer } from './audio'

type FakeAudio = {
  src: string
  currentTime: number
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
}

let instances: FakeAudio[]
let AudioSpy: ReturnType<typeof vi.fn>

beforeEach(() => {
  instances = []
  AudioSpy = vi.fn(function (this: FakeAudio, src?: string) {
    const el: FakeAudio = {
      src: src ?? '',
      currentTime: 0,
      play: vi.fn().mockResolvedValue(undefined),
      pause: vi.fn(),
    }
    instances.push(el)
    return el
  })
  // Stub the global Audio constructor.
  vi.stubGlobal('Audio', AudioSpy)
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
  })

  it('replays from the start: calling play() twice triggers two playbacks and resets currentTime', async () => {
    const player = createAudioPlayer('/grooves/x.mp3')
    const el = instances[0]

    await player.play()
    // Simulate playback advancing the position.
    el.currentTime = 42
    await player.play()

    expect(el.play).toHaveBeenCalledTimes(2)
    // Reset to 0 before the second playback.
    expect(el.currentTime).toBe(0)
  })

  it('play() returns the element play promise so a rejection propagates to the caller', async () => {
    const player = createAudioPlayer('/grooves/x.mp3')
    const failure = new Error('play failed')
    instances[0].play.mockRejectedValueOnce(failure)

    await expect(player.play()).rejects.toBe(failure)
  })

  it('stop() pauses the element', () => {
    const player = createAudioPlayer('/grooves/x.mp3')
    player.stop()
    expect(instances[0].pause).toHaveBeenCalledTimes(1)
  })

  it('dispose() pauses and releases the element', () => {
    const player = createAudioPlayer('/grooves/x.mp3')
    player.dispose()
    expect(instances[0].pause).toHaveBeenCalled()
  })
})
