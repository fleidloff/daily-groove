import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'

/** Any loop length works; the fake only has to be self-consistent. */
const LOOP_SECONDS = 10

// The player is mocked so playback can be driven without real audio.
// `createPageTransport` itself is NOT mocked: the hook is only an orchestrator
// over the real adapter in `lib/audio/transport.ts`, and one-groove-only is
// that adapter's structural property, not something the hook reimplements (R2).
vi.mock('../lib/audio/audio', () => ({
  createAudioPlayer: vi.fn(),
}))

import { createAudioPlayer } from '../lib/audio/audio'
import { useTransport } from './useTransport'

/** Today's groove — the only source a transport is ever built for (R6). */
const TODAY = {
  src: '/grooves/groove-01.mp3',
  loopSeconds: LOOP_SECONDS,
  headDelaySeconds: 0.025057,
}

/** A promise a test resolves by hand, so a press can be held mid-decode. */
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

/**
 * A stand-in for the real Web Audio player, keeping just enough state for the
 * hook to observe: a busy flag, a playing flag, elapsed seconds and a listener
 * set.
 *
 * It mirrors the real player's ordering — `play()` is busy from the press until
 * the underlying promise settles, sounds only once it resolves, and clears the
 * busy flag on rejection — and its `stop()` halts *and* rewinds, so the elapsed
 * time the hook reads returns to zero on its own.
 */
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
    // Latency-corrected seconds since the source started, which is what the
    // transport divides by the loop length.
    getElapsed: vi.fn(() => elapsed),
    subscribe: vi.fn((fn: () => void) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    }),
    dispose: vi.fn(),
    // Test-only seam: move the clock and notify, as the rAF poll would.
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

  // Step C3 — R5, R6, R7a
  it('returns a boolean playback state and nothing that names a groove', () => {
    const { result } = renderHook(() => useTransport(TODAY))

    expect(Object.keys(result.current).sort()).toEqual([
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
    // Nothing is constructed during render: the player is built on first press.
    expect(createAudioPlayer).not.toHaveBeenCalled()
  })

  // Step C3 — R7a: the busy state is the transport's, read through the same
  // subscription as the rest, not a flag the hook keeps for itself.
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

  // Step C3 — R7a, AC8d: a failed press leaves the busy state too.
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

  // Step C3 — R5, R6
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

    // The stopped player is kept and re-used: pressing again restarts it from
    // bar one rather than re-fetching and re-decoding the file.
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

    // One argument, and every field of it: the player loops at the groove's own
    // musical boundary, which it cannot find without the head delay.
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
    // Nothing sounds, so no control is left showing a stop affordance for a
    // groove that never started.
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

    // Disposal reaches the player: it is stopped and released, so no context
    // and no position poll outlives the page.
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
    // A re-render never rebuilds the transport, so playback survives.
    expect(result.current.isPlaying).toBe(true)
    expect(createAudioPlayer).toHaveBeenCalledTimes(1)
  })
})
