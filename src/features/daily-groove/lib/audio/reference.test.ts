import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createReferenceVoice } from './reference'
import { createAudioPlayer } from './audio'
import { secondsToNextBeat, type GrooveClock } from './beat'
import { REFERENCE_FADE_SECONDS, REFERENCE_LEVEL } from './level'
import { referenceOutput } from './output'
import {
  hasAudioContext,
  releaseAudioContext,
  sharedAudioContext,
} from './context'
import { installFakeAudioContext } from '../../testing/fakeAudioContext'
import type { ReferenceNote } from '../../data/notes.generated'
import type { Root } from '../../types'

const TWO: ReferenceNote[] = [
  { root: 'C', audioSrc: '/notes/note-c.mp3', midi: 60 },
  { root: 'D', audioSrc: '/notes/note-d.mp3', midi: 62 },
]

const ROOT_ORDER: Root[] = [
  'C',
  'C♯',
  'D',
  'E♭',
  'E',
  'F',
  'F♯',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
]

const TWELVE: ReferenceNote[] = ROOT_ORDER.map((root, index) => ({
  root,
  audioSrc: `/notes/note-${index}.mp3`,
  midi: 60 + index,
}))

afterEach(async () => {
  await releaseAudioContext()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

function makeClock(started: number | null = 0, beat = 0.5) {
  const listeners = new Set<() => void>()
  const state = { started }

  const clock: GrooveClock = {
    nextBeat: (now) =>
      state.started === null
        ? null
        : now + secondsToNextBeat(now - state.started, beat),
    isRunning: () => state.started !== null,
    subscribe: (listener) => {
      listeners.add(listener)
      return () => {
        listeners.delete(listener)
      }
    },
  }

  return {
    clock,
    stop() {
      state.started = null
    },
    fire() {
      for (const listener of [...listeners]) listener()
    },
    listenerCount: () => listeners.size,
  }
}

function startedAt(node: { start: { mock: { calls: unknown[][] } } }): number {
  return node.start.mock.calls[0][0] as number
}

function stoppedAt(node: { stop: { mock: { calls: unknown[][] } } }): number {
  return node.stop.mock.calls[0][0] as number
}

describe('playing a root (R1, AC1)', () => {
  it('fetches that root’s file and starts a one-shot node', async () => {
    const fake = installFakeAudioContext()
    const fetchSpy = globalThis.fetch as unknown as ReturnType<typeof vi.fn>
    const voice = createReferenceVoice(TWO)

    await voice.play('C')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(fetchSpy).toHaveBeenCalledWith('/notes/note-c.mp3')
    expect(fake.sources).toHaveLength(1)
    const [node] = fake.sources
    expect(node.loop).toBe(false)
    expect(node.start).toHaveBeenCalledTimes(1)
    expect(fake.gains).toHaveLength(1)
    expect(node.connect).toHaveBeenCalledWith(fake.gains[0])
    expect(fake.gains[0].connect).toHaveBeenCalledWith(
      fake.contexts[0].destination,
    )
    expect(fake.gains[0].gain.value).toBe(REFERENCE_LEVEL)
    expect(fake.gains[0].gain.value).toBeLessThan(1)
    expect(node.buffer).toBe(fake.contexts[0].decodedBuffer)
    voice.dispose()
  })

  it('plays through the shared context rather than one of its own (R14)', async () => {
    const fake = installFakeAudioContext()
    const voice = createReferenceVoice(TWO)

    await voice.play('C')

    expect(fake.contexts).toHaveLength(1)
    expect(hasAudioContext()).toBe(true)
    voice.dispose()
  })

  it('resumes a context the browser handed back suspended', async () => {
    const fake = installFakeAudioContext({ state: 'suspended' })
    const voice = createReferenceVoice(TWO)

    await voice.play('C')

    expect(fake.contexts[0].resume).toHaveBeenCalled()
    expect(fake.sources[0].start).toHaveBeenCalled()
    voice.dispose()
  })

  it('sounds nothing for a root the manifest does not carry', async () => {
    const fake = installFakeAudioContext()
    const voice = createReferenceVoice(TWO)

    await expect(voice.play('B♭')).resolves.toBeUndefined()

    expect(fake.sources).toHaveLength(0)
    voice.dispose()
  })
})

describe('a root is fetched once per session (R17, AC14)', () => {
  it('reuses the decoded buffer on a second tap', async () => {
    const fake = installFakeAudioContext()
    const voice = createReferenceVoice(TWO)

    await voice.play('C')
    await voice.play('C')

    expect(fake.fetchCalls).toBe(1)
    expect(fake.decodeCalls).toBe(1)
    expect(fake.sources).toHaveLength(2)
    voice.dispose()
  })

  it('shares one in-flight decode between two concurrent taps', async () => {
    const fake = installFakeAudioContext()
    const voice = createReferenceVoice(TWO)

    await Promise.all([voice.play('C'), voice.play('C')])

    expect(fake.fetchCalls).toBe(1)
    expect(fake.decodeCalls).toBe(1)
    voice.dispose()
  })
})

describe('a new note takes the voice from the ringing one (R5, AC4)', () => {
  it('fades the previous node out and leaves the new one ringing', async () => {
    const fake = installFakeAudioContext()
    const voice = createReferenceVoice(TWO)

    fake.advance(1)
    await voice.play('C')
    fake.advance(1)
    await voice.play('D')

    expect(fake.sources).toHaveLength(2)

    const [first] = fake.gains
    expect(first.gain.cancelScheduledValues).toHaveBeenCalledWith(2)
    expect(first.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      2 + REFERENCE_FADE_SECONDS,
    )
    expect(fake.sources[0].stop).toHaveBeenCalledWith(2 + REFERENCE_FADE_SECONDS)
    expect(fake.sources[1].stop).not.toHaveBeenCalled()

    fake.sources[0].onended?.()
    expect(fake.sources[0].disconnect).toHaveBeenCalledTimes(1)
    expect(first.disconnect).toHaveBeenCalledTimes(1)
    voice.dispose()
  })

  it('survives a node that has already ended', async () => {
    const fake = installFakeAudioContext()
    const voice = createReferenceVoice(TWO)

    await voice.play('C')
    fake.sources[0].stop.mockImplementation(() => {
      throw new Error('InvalidStateError')
    })

    await expect(voice.play('D')).resolves.toBeUndefined()
    expect(fake.sources[1].start).toHaveBeenCalled()
    voice.dispose()
  })
})

describe('every failure is swallowed (R10, R11, AC8, AC9)', () => {
  it('resolves and sounds nothing where there is no Web Audio (AC8)', async () => {
    const fake = installFakeAudioContext()
    vi.stubGlobal('AudioContext', undefined)
    const voice = createReferenceVoice(TWO)

    await expect(voice.play('C')).resolves.toBeUndefined()

    expect(fake.sources).toHaveLength(0)
    expect(hasAudioContext()).toBe(false)
    voice.dispose()
  })

  it('resolves and sounds nothing when the file 404s (AC9)', async () => {
    const fake = installFakeAudioContext()
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 404,
        arrayBuffer: async () => new ArrayBuffer(0),
      })),
    )
    const voice = createReferenceVoice(TWO)

    await expect(voice.play('C')).resolves.toBeUndefined()

    expect(fake.sources).toHaveLength(0)
    voice.dispose()
  })

  it('resolves and sounds nothing when the decode fails', async () => {
    const fake = installFakeAudioContext()
    fake.failNextDecode()
    const voice = createReferenceVoice(TWO)

    await expect(voice.play('C')).resolves.toBeUndefined()

    expect(fake.sources).toHaveLength(0)
    voice.dispose()
  })

  it('resolves and sounds nothing when the context will not resume', async () => {
    const fake = installFakeAudioContext({ state: 'suspended' })
    sharedAudioContext()
    fake.contexts[0].resume.mockRejectedValue(new Error('not allowed'))
    const voice = createReferenceVoice(TWO)

    await expect(voice.play('C')).resolves.toBeUndefined()

    expect(fake.sources).toHaveLength(0)
    voice.dispose()
  })

  it('retries a root whose first fetch failed', async () => {
    const fake = installFakeAudioContext()
    fake.failNextDecode()
    const voice = createReferenceVoice(TWO)

    await voice.play('C')
    await voice.play('C')

    expect(fake.fetchCalls).toBe(2)
    expect(fake.sources).toHaveLength(1)
    voice.dispose()
  })
})

describe('warming the row (R18, R19a)', () => {
  it('fetches all twelve and starts no node', async () => {
    const fake = installFakeAudioContext()
    const voice = createReferenceVoice(TWELVE)

    await voice.warm()

    expect(fake.fetchCalls).toBe(12)
    expect(fake.sources).toHaveLength(0)

    await voice.play('F♯')

    expect(fake.fetchCalls).toBe(12)
    expect(fake.sources).toHaveLength(1)
    voice.dispose()
  })

  it('resolves even when one note cannot be fetched, and keeps the rest', async () => {
    const fake = installFakeAudioContext()
    fake.failFetchFor('/notes/note-6.mp3')
    const voice = createReferenceVoice(TWELVE)

    await expect(voice.warm()).resolves.toBeUndefined()
    expect(fake.fetchCalls).toBe(12)

    for (const note of TWELVE) {
      if (note.root === 'F♯') continue
      await voice.play(note.root)
    }

    expect(fake.fetchCalls).toBe(12)
    expect(fake.sources).toHaveLength(11)
    voice.dispose()
  })

  it('is a best effort where there is no Web Audio at all', async () => {
    const fake = installFakeAudioContext()
    vi.stubGlobal('AudioContext', undefined)
    const voice = createReferenceVoice(TWELVE)

    await expect(voice.warm()).resolves.toBeUndefined()

    expect(fake.sources).toHaveLength(0)
    voice.dispose()
  })
})

describe('disposing (R13, R16)', () => {
  it('stops the ringing note and leaves the context open', async () => {
    const fake = installFakeAudioContext()
    const voice = createReferenceVoice(TWO)

    await voice.play('C')
    voice.dispose()

    expect(fake.sources[0].stop).toHaveBeenCalledTimes(1)
    expect(fake.contexts[0].close).not.toHaveBeenCalled()
    expect(hasAudioContext()).toBe(true)
  })

  it('drops its cache, so a later voice fetches afresh', async () => {
    const fake = installFakeAudioContext()
    const voice = createReferenceVoice(TWO)

    await voice.play('C')
    voice.dispose()

    const next = createReferenceVoice(TWO)
    await next.play('C')

    expect(fake.fetchCalls).toBe(2)
    next.dispose()
  })
})

describe('a note after the groove’s player is gone', () => {
  afterEach(async () => {
    vi.unstubAllGlobals()
    await releaseAudioContext()
  })

  it('still sounds once the player has been disposed (R16, AC13)', async () => {
    const fake = installFakeAudioContext()

    const player = createAudioPlayer({
      src: '/grooves/groove-01.mp3',
      loopSeconds: 9.142857,
      headDelaySeconds: 0.025057,
    })
    await player.play()
    const groovePlayed = fake.sources.length
    player.dispose()

    const voice = createReferenceVoice(TWO)
    await voice.play('C')

    expect(fake.sources.length).toBeGreaterThan(groovePlayed)
    const note = fake.sources[fake.sources.length - 1]
    expect(note.loop).toBe(false)
    expect(note.start).toHaveBeenCalledTimes(1)
    expect(fake.contexts).toHaveLength(1)
    expect(fake.contexts[0].state).not.toBe('closed')

    voice.dispose()
  })
})

describe('the fake context’s gain support', () => {
  it('makes a gain node the tests can read', () => {
    const fake = installFakeAudioContext()
    sharedAudioContext()

    const gain = fake.contexts[0].createGain()

    expect(gain.gain.value).toBe(1)
    gain.gain.setValueAtTime(0.5, 0)
    expect(gain.gain.value).toBe(0.5)
    gain.gain.linearRampToValueAtTime(0, 0.03)
    expect(gain.gain.linearRampToValueAtTime).toHaveBeenCalledWith(0, 0.03)
    expect(gain.gain.value).toBe(0.5)
    expect(fake.gains).toContain(gain)
  })
})

describe('with no groove running the note is immediate (R7, AC5)', () => {
  it('starts at the graph clock’s now when the voice has no clock', async () => {
    const fake = installFakeAudioContext()
    const voice = createReferenceVoice(TWO)

    fake.advance(4)
    await voice.play('C')

    expect(fake.sources[0].start).toHaveBeenCalledWith(4)
    voice.dispose()
  })

  it('starts at once when the clock reports no beat', async () => {
    const fake = installFakeAudioContext()
    const { clock } = makeClock(null)
    const voice = createReferenceVoice(TWO, clock)

    fake.advance(4)
    await voice.play('C')

    expect(fake.sources[0].start).toHaveBeenCalledWith(4)
    voice.dispose()
  })
})

describe('the note lands on the groove’s next beat (R6, AC4)', () => {
  it('schedules the note for the beat boundary, not for the tap', async () => {
    const fake = installFakeAudioContext()
    const { clock } = makeClock(0)
    const voice = createReferenceVoice(TWO, clock)

    fake.advance(1.2)
    await voice.play('C')

    expect(startedAt(fake.sources[0])).toBeCloseTo(1.5, 6)
    expect(startedAt(fake.sources[0])).toBeGreaterThan(1.2)
    voice.dispose()
  })
})

describe('just before a beat sounds now, just after waits (R6a, R6b)', () => {
  it('sounds at once for a tap inside the tolerance before a beat', async () => {
    const fake = installFakeAudioContext()
    const { clock } = makeClock(0)
    const voice = createReferenceVoice(TWO, clock)

    fake.advance(0.5 - 0.02)
    await voice.play('C')

    expect(fake.sources[0].start).toHaveBeenCalledWith(fake.currentTime)
    voice.dispose()
  })

  it('waits for the following beat for a tap just after one', async () => {
    const fake = installFakeAudioContext()
    const { clock } = makeClock(0)
    const voice = createReferenceVoice(TWO, clock)

    fake.advance(0.52)
    await voice.play('D')

    expect(startedAt(fake.sources[0])).toBeCloseTo(1.0, 6)
    voice.dispose()
  })
})

describe('a second tap replaces a pending note (R10, AC8)', () => {
  it('leaves exactly one note to arrive', async () => {
    const fake = installFakeAudioContext()
    const { clock } = makeClock(0)
    const voice = createReferenceVoice(TWO, clock)

    fake.advance(1.2)
    await voice.play('C')
    await voice.play('D')

    expect(fake.sources[0].stop).toHaveBeenCalledTimes(1)
    expect(stoppedAt(fake.sources[0])).toBeLessThanOrEqual(
      startedAt(fake.sources[0]),
    )
    expect(fake.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      expect.any(Number),
    )
    expect(startedAt(fake.sources[1])).toBeCloseTo(1.5, 6)
    expect(fake.sources[1].stop).not.toHaveBeenCalled()
    voice.dispose()
  })
})

describe('the shared output arbitrates both rows (R10a, R10b, AC8c)', () => {
  it('gets out of the way when another voice claims the output', async () => {
    const fake = installFakeAudioContext()
    const voice = createReferenceVoice(TWO)

    await voice.play('C')
    referenceOutput().claim(() => {})

    expect(fake.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      expect.any(Number),
    )
    expect(fake.sources[0].stop).toHaveBeenCalledTimes(1)
    voice.dispose()
  })

  it('silences the other voice when a root is tapped', async () => {
    installFakeAudioContext()
    const voice = createReferenceVoice(TWO)
    const cancel = vi.fn()

    referenceOutput().claim(cancel)
    await voice.play('D')

    expect(cancel).toHaveBeenCalledTimes(1)
    voice.dispose()
  })
})

describe('a pending note is dropped when the groove stops (R12, AC10)', () => {
  it('never sounds, and stops watching once it is gone', async () => {
    const fake = installFakeAudioContext()
    const groove = makeClock(0)
    const voice = createReferenceVoice(TWO, groove.clock)

    fake.advance(1.2)
    await voice.play('C')
    expect(groove.listenerCount()).toBe(1)

    groove.stop()
    groove.fire()

    expect(fake.sources[0].stop).toHaveBeenCalledTimes(1)
    expect(stoppedAt(fake.sources[0])).toBeLessThan(1.5)
    expect(fake.gains[0].gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0,
      expect.any(Number),
    )

    groove.fire()
    expect(fake.sources[0].stop).toHaveBeenCalledTimes(1)
    expect(groove.listenerCount()).toBe(0)
    voice.dispose()
  })
})

describe('a sounding note rings on when the groove stops (R11, AC9)', () => {
  it('is left alone once it has reached its start time', async () => {
    const fake = installFakeAudioContext()
    const groove = makeClock(0)
    const voice = createReferenceVoice(TWO, groove.clock)

    fake.advance(1.2)
    await voice.play('C')
    fake.advance(0.5)

    groove.stop()
    groove.fire()

    expect(fake.sources[0].stop).not.toHaveBeenCalled()
    expect(fake.gains[0].gain.linearRampToValueAtTime).not.toHaveBeenCalled()
    voice.dispose()
  })
})

describe('reading the groove’s clock is one-way (R9, AC7)', () => {
  it('touches only the clock’s three read-only members', async () => {
    const fake = installFakeAudioContext()
    const { clock } = makeClock(0)
    const reads = new Set<string>()
    const watched = new Proxy(clock, {
      get(target, property, receiver) {
        reads.add(String(property))
        return Reflect.get(target, property, receiver)
      },
    })
    const voice = createReferenceVoice(TWO, watched)

    fake.advance(1.2)
    await voice.play('C')

    const allowed = ['nextBeat', 'isRunning', 'subscribe']
    expect([...reads].filter((key) => !allowed.includes(key))).toEqual([])
    voice.dispose()
  })

  it('cannot see the transport from its own source', () => {
    const source = readFileSync(
      join(
        process.cwd(),
        'src',
        'features',
        'daily-groove',
        'lib',
        'audio',
        'reference.ts',
      ),
      'utf8',
    )

    for (const forbidden of [
      "'./transport'",
      "'./audio'",
      'createPageTransport',
      'createAudioPlayer',
      '.toggle(',
    ]) {
      expect(source).not.toContain(forbidden)
    }
  })
})

describe('every failure is still silence (R14, AC12)', () => {
  it('resolves and claims nothing when the gain node cannot be built', async () => {
    const fake = installFakeAudioContext()
    sharedAudioContext()
    vi.spyOn(fake.contexts[0], 'createGain').mockImplementation(() => {
      throw new Error('no gain')
    })
    const voice = createReferenceVoice(TWO)

    await expect(voice.play('C')).resolves.toBeUndefined()

    expect(fake.sources).toHaveLength(0)
    expect(referenceOutput().isClaimed()).toBe(false)
    voice.dispose()
  })

  it('still sounds the note, immediately, when the clock throws', async () => {
    const fake = installFakeAudioContext()
    const broken: GrooveClock = {
      nextBeat: () => {
        throw new Error('no clock')
      },
      isRunning: () => true,
      subscribe: () => () => {},
    }
    const voice = createReferenceVoice(TWO, broken)

    fake.advance(2)
    await expect(voice.play('C')).resolves.toBeUndefined()

    expect(fake.sources[0].start).toHaveBeenCalledWith(2)
    voice.dispose()
  })
})
