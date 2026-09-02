import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

const LOOP_SECONDS = 10

const START_TIME = 4

vi.mock('../lib/audio/audio', () => ({
  createAudioPlayer: vi.fn(),
}))

import { createAudioPlayer } from '../lib/audio/audio'
import { useTransport } from './useTransport'

const TODAY = {
  src: '/grooves/groove-01.mp3',
  loopSeconds: LOOP_SECONDS,
  headDelaySeconds: 0.025057,
}

function deferred() {
  let release = () => {}
  let fail: (error: Error) => void = () => {}
  const promise = new Promise<void>((resolve, reject) => {
    release = () => {
      resolve()
    }
    fail = reject
  })
  return { promise, release, fail }
}

function makePlayer(play: () => Promise<void> = () => Promise.resolve()) {
  const listeners = new Set<() => void>()
  let playing = false
  let loading = false
  let elapsed = 0

  const notify = () => {
    for (const listener of Array.from(listeners)) listener()
  }

  return {
    load: vi.fn(async () => {}),
    play: vi.fn(async () => {
      loading = true
      notify()
      try {
        await play()
        loading = false
        playing = true
        elapsed = 0
        notify()
      } catch (error) {
        loading = false
        playing = false
        notify()
        throw error
      }
    }),
    stop: vi.fn(() => {
      playing = false
      elapsed = 0
      notify()
    }),
    isLoading: vi.fn(() => loading),
    isPlaying: vi.fn(() => playing),
    getElapsed: vi.fn(() => elapsed),
    getStartTime: vi.fn(() => (playing ? START_TIME : null)),
    subscribe: vi.fn((fn: () => void) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    }),
    dispose: vi.fn(),
    seek: (fraction: number) => {
      elapsed = fraction * LOOP_SECONDS
      notify()
    },
  }
}

describe('useTransport', () => {
  beforeEach(() => {
    vi.mocked(createAudioPlayer).mockReset()
    vi.mocked(createAudioPlayer).mockReturnValue(makePlayer())
  })

  it('returns a boolean playback state and nothing that names a groove', () => {
    const { result } = renderHook(() => useTransport(TODAY))

    expect(Object.keys(result.current).sort()).toEqual([
      'clock',
      'error',
      'isPlaying',
      'loading',
      'position',
      'toggle',
    ])
    expect(result.current.isPlaying).toBe(false)
    expect(result.current.loading).toBe(false)
    expect(result.current.position).toBe(0)
    expect(result.current.error).toBe(false)
    expect(createAudioPlayer).not.toHaveBeenCalled()
  })

  it('follows the transport’s loading state from press to first sound', async () => {
    const held = deferred()
    const player = makePlayer(() => held.promise)
    vi.mocked(createAudioPlayer).mockReturnValue(player)
    const { result } = renderHook(() => useTransport(TODAY))

    let pressed: Promise<void> = Promise.resolve()
    await act(async () => {
      pressed = result.current.toggle()
    })

    expect(result.current.loading).toBe(true)

    await act(async () => {
      held.release()
      await pressed
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.isPlaying).toBe(true)
  })

  it('leaves the loading state when the press fails', async () => {
    const held = deferred()
    const player = makePlayer(() => held.promise)
    vi.mocked(createAudioPlayer).mockReturnValue(player)
    const { result } = renderHook(() => useTransport(TODAY))

    let pressed: Promise<void> = Promise.resolve()
    await act(async () => {
      pressed = result.current.toggle()
    })
    expect(result.current.loading).toBe(true)

    await act(async () => {
      held.fail(new Error('decode failed'))
      await pressed
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.isPlaying).toBe(false)
    expect(result.current.error).toBe(true)
  })

  it('sounds the source it was built for, with no argument to the press', async () => {
    const player = makePlayer()
    vi.mocked(createAudioPlayer).mockReturnValue(player)
    const { result } = renderHook(() => useTransport(TODAY))

    await act(async () => {
      await result.current.toggle()
    })

    expect(result.current.isPlaying).toBe(true)
    expect(player.play).toHaveBeenCalledTimes(1)
    expect(vi.mocked(createAudioPlayer).mock.calls[0][0]).toBe(TODAY)
    expect(result.current.error).toBe(false)
  })

  it('stops on a second toggle, and restarts on a third', async () => {
    const player = makePlayer()
    vi.mocked(createAudioPlayer).mockReturnValue(player)
    const { result } = renderHook(() => useTransport(TODAY))

    await act(async () => {
      await result.current.toggle()
    })
    await act(async () => {
      await result.current.toggle()
    })

    expect(result.current.isPlaying).toBe(false)
    expect(player.stop).toHaveBeenCalledTimes(1)

    await act(async () => {
      await result.current.toggle()
    })
    expect(result.current.isPlaying).toBe(true)
    expect(player.play).toHaveBeenCalledTimes(2)
    expect(createAudioPlayer).toHaveBeenCalledTimes(1)
    expect(player.dispose).not.toHaveBeenCalled()
  })

  it('follows the sounding position, and returns to zero on stop', async () => {
    const player = makePlayer()
    vi.mocked(createAudioPlayer).mockReturnValue(player)
    const { result } = renderHook(() => useTransport(TODAY))

    await act(async () => {
      await result.current.toggle()
    })
    await act(async () => {
      player.seek(0.5)
    })
    expect(result.current.position).toBeCloseTo(0.5, 6)

    await act(async () => {
      await result.current.toggle()
    })
    expect(result.current.position).toBe(0)
  })

  it("builds today's player from the whole source, head delay and all (R4)", async () => {
    const { result } = renderHook(() => useTransport(TODAY))

    await act(async () => {
      await result.current.toggle()
    })

    expect(createAudioPlayer).toHaveBeenCalledWith({
      src: TODAY.src,
      loopSeconds: LOOP_SECONDS,
      headDelaySeconds: TODAY.headDelaySeconds,
    })
  })

  it('surfaces an error when the player fails to load, and rolls back', async () => {
    vi.mocked(createAudioPlayer).mockReturnValue(
      makePlayer(() => Promise.reject(new Error('load failed'))),
    )
    const { result } = renderHook(() => useTransport(TODAY))

    await act(async () => {
      await result.current.toggle()
    })

    expect(result.current.error).toBe(true)
    expect(result.current.isPlaying).toBe(false)
  })

  it('clears the error on the next toggle', async () => {
    let fail = true
    vi.mocked(createAudioPlayer).mockReturnValue(
      makePlayer(() =>
        fail ? Promise.reject(new Error('load failed')) : Promise.resolve(),
      ),
    )
    const { result } = renderHook(() => useTransport(TODAY))

    await act(async () => {
      await result.current.toggle()
    })
    expect(result.current.error).toBe(true)

    fail = false
    await act(async () => {
      await result.current.toggle()
    })

    expect(result.current.error).toBe(false)
    expect(result.current.isPlaying).toBe(true)
  })

  it('disposes the transport on unmount', async () => {
    const player = makePlayer()
    vi.mocked(createAudioPlayer).mockReturnValue(player)
    const { result, unmount } = renderHook(() => useTransport(TODAY))

    await act(async () => {
      await result.current.toggle()
    })
    expect(player.dispose).not.toHaveBeenCalled()

    unmount()

    expect(player.stop).toHaveBeenCalled()
    expect(player.dispose).toHaveBeenCalledTimes(1)
  })

  it('keeps one transport across renders (R1)', async () => {
    const { result, rerender } = renderHook(() => useTransport(TODAY))

    const first = result.current.toggle
    rerender()
    expect(result.current.toggle).toBe(first)

    await act(async () => {
      await result.current.toggle()
    })
    rerender()
    expect(result.current.isPlaying).toBe(true)
    expect(createAudioPlayer).toHaveBeenCalledTimes(1)
  })

  describe('the beat grid (R8)', () => {
    it('offers no beat before the groove has started', () => {
      const { result } = renderHook(() => useTransport(TODAY, 120))

      expect(result.current.clock.isRunning()).toBe(false)
      expect(result.current.clock.nextBeat(0)).toBeNull()
    })

    it('answers with the next beat of the tempo it was given', async () => {
      const { result } = renderHook(() => useTransport(TODAY, 120))

      await act(async () => {
        await result.current.toggle()
      })

      expect(result.current.clock.isRunning()).toBe(true)
      expect(result.current.clock.nextBeat(START_TIME + 1.2)).toBeCloseTo(
        START_TIME + 1.5,
        6,
      )
    })

    it('hands down the same grid on every render (R6)', async () => {
      const { result, rerender } = renderHook(() => useTransport(TODAY, 120))
      const first = result.current.clock

      rerender()
      await act(async () => {
        await result.current.toggle()
      })
      rerender()

      expect(result.current.clock).toBe(first)
    })

    it('degrades to an immediate note when no tempo is given (R7)', async () => {
      const { result } = renderHook(() => useTransport(TODAY))

      expect(result.current.clock.nextBeat(0)).toBeNull()

      await act(async () => {
        await result.current.toggle()
      })

      const now = START_TIME + 1.2
      expect(result.current.clock.nextBeat(now)).toBe(now)
    })
  })
})
