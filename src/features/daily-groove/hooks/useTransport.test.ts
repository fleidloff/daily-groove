import { beforeEach, describe, expect, it, vi } from 'vitest'
import { HEAD_DELAY_SECONDS } from '../lib/audio/transport'

/** Any loop length works; the fake only has to be self-consistent. */
const LOOP_SECONDS = 10
import { act, renderHook } from '@testing-library/react'

// The audio element is mocked so playback can be driven without real media.
// `createPageTransport` itself is NOT mocked: the hook is only an orchestrator
// over the real adapter in `lib/audio/transport.ts`, and exclusivity is that
// adapter's structural property, not something the hook reimplements (R2).
vi.mock('../lib/audio/audio', () => ({
  createAudioPlayer: vi.fn(),
}))

import { createAudioPlayer } from '../lib/audio/audio'
import { useTransport } from './useTransport'

const TODAY = { id: 'groove-01', src: '/grooves/groove-01.mp3' }
const OTHER = { id: 'groove-02', src: '/grooves/groove-02.mp3' }

/**
 * A stand-in for the real AudioPlayer that keeps just enough state for the hook
 * to observe: a playing flag, a position, and a listener set. It mirrors the
 * real player's optimistic ordering — `play()` flips `isPlaying()` before the
 * underlying promise settles and reverts on rejection — and its `stop()` halts
 * *and* rewinds, so the position the hook reads returns to zero on its own.
 */
function makePlayer(play: () => Promise<void> = () => Promise.resolve()) {
  const listeners = new Set<() => void>()
  let playing = false
  let position = 0

  const notify = () => {
    for (const listener of Array.from(listeners)) listener()
  }

  return {
    play: vi.fn(async () => {
      playing = true
      notify()
      try {
        await play()
      } catch (error) {
        playing = false
        notify()
        throw error
      }
    }),
    stop: vi.fn(() => {
      playing = false
      position = 0
      notify()
    }),
    getPosition: vi.fn(() => position),
    // Seconds into the file, which is what the transport actually reads. The
    // fake keeps it consistent with `position` so a `seek` still means the same
    // fraction of the loop it always did.
    getCurrentTime: vi.fn(() =>
      position === 0 ? 0 : HEAD_DELAY_SECONDS + position * LOOP_SECONDS,
    ),
    isPlaying: vi.fn(() => playing),
    subscribe: vi.fn((fn: () => void) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    }),
    dispose: vi.fn(),
    // Test-only seam: move the loop position and notify, as the rAF poll would.
    seek: (next: number) => {
      position = next
      notify()
    },
  }
}

/** A fresh player per source, kept by src so a swap can be seen from both sides. */
function playersBySource() {
  const made = new Map<string, ReturnType<typeof makePlayer>>()
  vi.mocked(createAudioPlayer).mockImplementation((src: string) => {
    const player = makePlayer()
    made.set(src, player)
    return player
  })
  return made
}

describe('useTransport', () => {
  beforeEach(() => {
    vi.mocked(createAudioPlayer).mockReset()
    vi.mocked(createAudioPlayer).mockReturnValue(makePlayer())
  })

  it('starts silent, with nothing sounding and no error (AC2)', () => {
    const { result } = renderHook(() => useTransport())

    expect(result.current.soundingId).toBeNull()
    expect(result.current.position).toBe(0)
    expect(result.current.error).toBe(false)
    // Nothing is constructed during render: the player is built on first press.
    expect(createAudioPlayer).not.toHaveBeenCalled()
  })

  it('sounds the source it is handed (AC2)', async () => {
    const player = makePlayer()
    vi.mocked(createAudioPlayer).mockReturnValue(player)
    const { result } = renderHook(() => useTransport())

    await act(async () => {
      await result.current.toggle(TODAY)
    })

    expect(result.current.soundingId).toBe(TODAY.id)
    expect(player.play).toHaveBeenCalledTimes(1)
    expect(result.current.error).toBe(false)
  })

  it('stops the same source on a second toggle, and restarts on a third', async () => {
    const player = makePlayer()
    vi.mocked(createAudioPlayer).mockReturnValue(player)
    const { result } = renderHook(() => useTransport())

    await act(async () => {
      await result.current.toggle(TODAY)
    })
    await act(async () => {
      await result.current.toggle(TODAY)
    })

    expect(result.current.soundingId).toBeNull()
    expect(player.stop).toHaveBeenCalledTimes(1)

    // The stopped player is kept and re-used: pressing again restarts it from
    // bar one rather than building a second element.
    await act(async () => {
      await result.current.toggle(TODAY)
    })
    expect(result.current.soundingId).toBe(TODAY.id)
    expect(player.play).toHaveBeenCalledTimes(2)
    expect(createAudioPlayer).toHaveBeenCalledTimes(1)
    expect(player.dispose).not.toHaveBeenCalled()
  })

  it('follows the sounding position, and returns to zero on stop', async () => {
    const player = makePlayer()
    vi.mocked(createAudioPlayer).mockReturnValue(player)
    const { result } = renderHook(() => useTransport())

    await act(async () => {
      await result.current.toggle(TODAY)
    })
    await act(async () => {
      player.seek(0.5)
    })
    expect(result.current.position).toBe(0.5)

    await act(async () => {
      await result.current.toggle(TODAY)
    })
    expect(result.current.position).toBe(0)
  })

  // Moved from GroovePuzzle.test.tsx — Step D2: the groove repeats until the
  // player stops it. It asserts on the adapter, not on any rendered control.
  it("creates today's player looped (R17, AC11)", async () => {
    const { result } = renderHook(() => useTransport())

    await act(async () => {
      await result.current.toggle(TODAY)
    })

    expect(createAudioPlayer).toHaveBeenCalledWith(
      TODAY.src,
      expect.objectContaining({ loop: true }),
    )
  })

  it('leaves exactly one groove sounding as sources are played through (AC2)', async () => {
    const made = playersBySource()
    const { result } = renderHook(() => useTransport())

    await act(async () => {
      await result.current.toggle(TODAY)
    })
    expect(result.current.soundingId).toBe(TODAY.id)

    // A different source takes over: the outgoing player is stopped and
    // released entirely, so nothing is left polling behind it.
    await act(async () => {
      await result.current.toggle(OTHER)
    })
    expect(result.current.soundingId).toBe(OTHER.id)
    expect(made.get(TODAY.src)?.stop).toHaveBeenCalled()
    expect(made.get(TODAY.src)?.dispose).toHaveBeenCalled()
    expect(made.get(OTHER.src)?.play).toHaveBeenCalledTimes(1)
  })

  it('surfaces an error when the player fails to load, and rolls back (AC2)', async () => {
    vi.mocked(createAudioPlayer).mockReturnValue(
      makePlayer(() => Promise.reject(new Error('load failed'))),
    )
    const { result } = renderHook(() => useTransport())

    await act(async () => {
      await result.current.toggle(TODAY)
    })

    expect(result.current.error).toBe(true)
    // Nothing sounds, so no control is left showing a stop affordance for a
    // groove that never started.
    expect(result.current.soundingId).toBeNull()
  })

  it('clears the error on the next toggle', async () => {
    let fail = true
    vi.mocked(createAudioPlayer).mockReturnValue(
      makePlayer(() =>
        fail ? Promise.reject(new Error('load failed')) : Promise.resolve(),
      ),
    )
    const { result } = renderHook(() => useTransport())

    await act(async () => {
      await result.current.toggle(TODAY)
    })
    expect(result.current.error).toBe(true)

    fail = false
    await act(async () => {
      await result.current.toggle(TODAY)
    })

    expect(result.current.error).toBe(false)
    expect(result.current.soundingId).toBe(TODAY.id)
  })

  it('disposes the transport on unmount (AC2)', async () => {
    const player = makePlayer()
    vi.mocked(createAudioPlayer).mockReturnValue(player)
    const { result, unmount } = renderHook(() => useTransport())

    await act(async () => {
      await result.current.toggle(TODAY)
    })
    expect(player.dispose).not.toHaveBeenCalled()

    unmount()

    // Disposal reaches the player: it is stopped and released, so no media
    // element and no position poll outlives the page.
    expect(player.stop).toHaveBeenCalled()
    expect(player.dispose).toHaveBeenCalledTimes(1)
  })

  it('keeps one transport across renders (R1)', async () => {
    const { result, rerender } = renderHook(() => useTransport())

    const first = result.current.toggle
    rerender()
    expect(result.current.toggle).toBe(first)

    await act(async () => {
      await result.current.toggle(TODAY)
    })
    rerender()
    // A re-render never rebuilds the transport, so the sounding groove survives.
    expect(result.current.soundingId).toBe(TODAY.id)
    expect(createAudioPlayer).toHaveBeenCalledTimes(1)
  })
})
