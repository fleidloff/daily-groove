import { beforeEach, describe, expect, it, vi } from 'vitest'

// The player is stubbed: these tests assert the transport's source-swapping
// rules, not playback. No React and no DOM are involved.
vi.mock('./audio', () => ({
  createAudioPlayer: vi.fn(),
}))

import { createAudioPlayer } from './audio'
import { HEAD_DELAY_SECONDS, createPageTransport } from './transport'

type FakePlayer = ReturnType<typeof makePlayer>

/** A stand-in for `AudioPlayer` that records what was asked of it. */
function makePlayer(play: () => Promise<void> = () => Promise.resolve()) {
  const listeners = new Set<() => void>()
  let playing = false
  let position = 0
  let currentTime = 0

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
      currentTime = 0
      notify()
    }),
    getPosition: vi.fn(() => position),
    getCurrentTime: vi.fn(() => currentTime),
    isPlaying: vi.fn(() => playing),
    subscribe: vi.fn((fn: () => void) => {
      listeners.add(fn)
      return () => {
        listeners.delete(fn)
      }
    }),
    dispose: vi.fn(() => {
      playing = false
      listeners.clear()
    }),
    // Test-only handles.
    setPosition(next: number) {
      position = next
    },
    setCurrentTime(next: number) {
      currentTime = next
    },
    emit: notify,
    listenerCount: () => listeners.size,
  }
}

/** Hands out a fresh fake player per `createAudioPlayer` call, in order. */
function usePlayers(): FakePlayer[] {
  const built: FakePlayer[] = []
  vi.mocked(createAudioPlayer).mockImplementation(() => {
    const player = makePlayer()
    built.push(player)
    return player as unknown as ReturnType<typeof createAudioPlayer>
  })
  return built
}

const A = { id: 'a', src: '/a.mp3' }
const B = { id: 'b', src: '/b.mp3' }

describe('createPageTransport', () => {
  beforeEach(() => {
    vi.mocked(createAudioPlayer).mockReset()
  })

  // Step D1 — R3, R4, AC2, AC3, AC4
  it('starts a source, swaps to another, and stops on a repeat press', async () => {
    const players = usePlayers()
    const transport = createPageTransport()

    expect(transport.getSoundingId()).toBeNull()

    await transport.toggle(A)
    expect(transport.getSoundingId()).toBe('a')
    expect(createAudioPlayer).toHaveBeenCalledTimes(1)
    expect(vi.mocked(createAudioPlayer).mock.calls[0][0]).toBe('/a.mp3')
    expect(players[0].play).toHaveBeenCalledTimes(1)

    await transport.toggle(B)
    expect(transport.getSoundingId()).toBe('b')
    // The swap must release the old player entirely: a merely-stopped player
    // keeps its rAF poll and its listener wired up (R4).
    expect(players[0].stop).toHaveBeenCalledTimes(1)
    expect(players[0].dispose).toHaveBeenCalledTimes(1)
    expect(createAudioPlayer).toHaveBeenCalledTimes(2)
    expect(vi.mocked(createAudioPlayer).mock.calls[1][0]).toBe('/b.mp3')
    expect(players[1].play).toHaveBeenCalledTimes(1)

    await transport.toggle(B)
    expect(transport.getSoundingId()).toBeNull()
    expect(players[1].stop).toHaveBeenCalledTimes(1)
  })

  // Step D1 — R4: one player at a time, never a cache per card.
  it('never holds more than one player at a time', async () => {
    const players = usePlayers()
    const transport = createPageTransport()

    await transport.toggle(A)
    await transport.toggle(B)
    await transport.toggle(A)

    expect(players).toHaveLength(3)
    // Every player but the current one has been disposed.
    expect(players[0].dispose).toHaveBeenCalledTimes(1)
    expect(players[1].dispose).toHaveBeenCalledTimes(1)
    expect(players[2].dispose).not.toHaveBeenCalled()
    expect(transport.getSoundingId()).toBe('a')
  })

  // Step D2 — R3, AC4
  it('stops the sounding source when it is toggled again', async () => {
    const players = usePlayers()
    const transport = createPageTransport()

    await transport.toggle(A)
    await transport.toggle(A)

    expect(transport.getSoundingId()).toBeNull()
    expect(players[0].stop).toHaveBeenCalledTimes(1)
  })

  // Step D2 — R3: stopping means back to the top. The player itself is
  // RETAINED, not rebuilt: `stop()` already rewound it, so re-pressing the
  // same source restarts at bar 1 without constructing a new Audio element.
  // rather than resuming a held position.
  it('plays again after being stopped', async () => {
    const players = usePlayers()
    const transport = createPageTransport()

    await transport.toggle(A)
    await transport.toggle(A)
    await transport.toggle(A)

    expect(transport.getSoundingId()).toBe('a')
    expect(players[players.length - 1].play).toHaveBeenCalled()
  })

  // Step D3 — R12, AC14
  it('constructs every player with loop: true, swaps included', async () => {
    usePlayers()
    const transport = createPageTransport()

    await transport.toggle(A)
    await transport.toggle(B)

    expect(vi.mocked(createAudioPlayer).mock.calls[0][1]).toEqual({ loop: true })
    expect(vi.mocked(createAudioPlayer).mock.calls[1][1]).toEqual({ loop: true })
  })

  // Step D4 — R4
  it('disposes the sounding player, clears listeners and goes silent', async () => {
    const players = usePlayers()
    const transport = createPageTransport()
    const listener = vi.fn()
    transport.subscribe(listener)

    await transport.toggle(A)
    listener.mockClear()

    transport.dispose()

    expect(players[0].stop).toHaveBeenCalled()
    expect(players[0].dispose).toHaveBeenCalledTimes(1)
    expect(transport.getSoundingId()).toBeNull()

    // The listener set is empty: a late notification reaches nobody.
    players[0].emit()
    expect(listener).not.toHaveBeenCalled()
  })

  it('is inert after disposal', async () => {
    usePlayers()
    const transport = createPageTransport()

    transport.dispose()

    expect(transport.getSoundingId()).toBeNull()
    expect(transport.getPosition()).toBe(0)
  })

  describe('position', () => {
    it('is 0 when nothing sounds', () => {
      usePlayers()
      const transport = createPageTransport()

      expect(transport.getPosition()).toBe(0)
      expect(createAudioPlayer).not.toHaveBeenCalled()
    })

    it('reads the sounding player, and returns to 0 when it stops', async () => {
      const players = usePlayers()
      const transport = createPageTransport()

      await transport.toggle(A)
      players[0].setPosition(0.42)
      expect(transport.getPosition()).toBeCloseTo(0.42)

      await transport.toggle(A)
      expect(transport.getPosition()).toBe(0)
    })
  })

  describe('subscribe', () => {
    it('forwards the sounding player’s notifications', async () => {
      const players = usePlayers()
      const transport = createPageTransport()
      const listener = vi.fn()
      transport.subscribe(listener)

      await transport.toggle(A)
      expect(listener).toHaveBeenCalled()

      listener.mockClear()
      players[0].emit()
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('forwards from the new player after a swap and not the old one', async () => {
      const players = usePlayers()
      const transport = createPageTransport()
      const listener = vi.fn()
      transport.subscribe(listener)

      await transport.toggle(A)
      await transport.toggle(B)
      listener.mockClear()

      players[0].emit()
      expect(listener).not.toHaveBeenCalled()

      players[1].emit()
      expect(listener).toHaveBeenCalledTimes(1)
    })

    it('returns an unsubscribe that stops the notifications', async () => {
      const players = usePlayers()
      const transport = createPageTransport()
      const listener = vi.fn()
      const unsubscribe = transport.subscribe(listener)

      await transport.toggle(A)
      unsubscribe()
      listener.mockClear()

      players[0].emit()
      expect(listener).not.toHaveBeenCalled()
    })

    it('notifies when a source starts and when it stops', async () => {
      usePlayers()
      const transport = createPageTransport()
      const listener = vi.fn()
      transport.subscribe(listener)

      await transport.toggle(A)
      expect(listener).toHaveBeenCalled()

      listener.mockClear()
      await transport.toggle(A)
      expect(listener).toHaveBeenCalled()
    })
  })

  describe('a play failure', () => {
    it('propagates so the caller can offer a retry', async () => {
      const failing = makePlayer(() => Promise.reject(new Error('no audio')))
      vi.mocked(createAudioPlayer).mockReturnValue(
        failing as unknown as ReturnType<typeof createAudioPlayer>,
      )
      const transport = createPageTransport()

      await expect(transport.toggle(A)).rejects.toThrow('no audio')
      // Nothing sounds, so no control is left showing a stop affordance for a
      // groove that never started.
      expect(transport.getSoundingId()).toBeNull()
    })

    it('leaves the transport usable for the next press', async () => {
      const failing = makePlayer(() => Promise.reject(new Error('no audio')))
      const working = makePlayer()
      vi.mocked(createAudioPlayer)
        .mockReturnValueOnce(
          failing as unknown as ReturnType<typeof createAudioPlayer>,
        )
        .mockReturnValue(
          working as unknown as ReturnType<typeof createAudioPlayer>,
        )
      const transport = createPageTransport()

      await expect(transport.toggle(A)).rejects.toThrow('no audio')

      await transport.toggle(B)
      expect(transport.getSoundingId()).toBe('b')
      expect(working.play).toHaveBeenCalledTimes(1)
    })
  })
})

/**
 * The bar highlight is drawn by quartering `getPosition()`, so a position taken
 * from the file's own duration puts the bar lines in the wrong place: an mp3
 * carries ~25ms of encoder delay at its head and padding at its tail, and for
 * this catalogue the file runs 26-47ms longer than the music. A source that
 * declares its musical `loopSeconds` gets mapped against that instead.
 */
describe('musical position', () => {
  const TEN_SECOND_LOOP = { id: 'm', src: '/m.mp3', loopSeconds: 10 }

  it('reads 0 through the encoder delay, before the music starts', async () => {
    const players = usePlayers()
    const transport = createPageTransport()
    await transport.toggle(TEN_SECOND_LOOP)

    players[0].setCurrentTime(0)
    expect(transport.getPosition()).toBe(0)
    // Still inside the 25ms of leading silence.
    players[0].setCurrentTime(0.02)
    expect(transport.getPosition()).toBe(0)
  })

  it('puts the halfway point at the middle of the music, not the file', async () => {
    const players = usePlayers()
    const transport = createPageTransport()
    await transport.toggle(TEN_SECOND_LOOP)

    // Encoder delay plus half of a ten-second loop.
    players[0].setCurrentTime(HEAD_DELAY_SECONDS + 5)
    expect(transport.getPosition()).toBeCloseTo(0.5, 6)
  })

  it('puts each bar line a quarter through the music', async () => {
    const players = usePlayers()
    const transport = createPageTransport()
    await transport.toggle(TEN_SECOND_LOOP)

    for (const quarter of [1, 2, 3]) {
      players[0].setCurrentTime(HEAD_DELAY_SECONDS + 2.5 * quarter)
      expect(transport.getPosition()).toBeCloseTo(quarter / 4, 6)
    }
  })

  it('clamps to 1 across the file\'s trailing padding', async () => {
    const players = usePlayers()
    const transport = createPageTransport()
    await transport.toggle(TEN_SECOND_LOOP)

    players[0].setCurrentTime(HEAD_DELAY_SECONDS + 10)
    expect(transport.getPosition()).toBe(1)
    // Past the music, still inside the file.
    players[0].setCurrentTime(HEAD_DELAY_SECONDS + 10.04)
    expect(transport.getPosition()).toBe(1)
  })

  it('falls back to the file position when a source declares no loop length', async () => {
    const players = usePlayers()
    const transport = createPageTransport()
    await transport.toggle(A)

    players[0].setPosition(0.42)
    players[0].setCurrentTime(999)
    expect(transport.getPosition()).toBe(0.42)
  })

  it('reads 0 when nothing is sounding', async () => {
    const players = usePlayers()
    const transport = createPageTransport()
    await transport.toggle(TEN_SECOND_LOOP)
    players[0].setCurrentTime(HEAD_DELAY_SECONDS + 5)

    await transport.toggle(TEN_SECOND_LOOP)
    expect(transport.getPosition()).toBe(0)
  })
})
