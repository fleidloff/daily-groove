import { afterEach, describe, expect, it, vi } from 'vitest'
import { createReferenceVoice } from './reference'
import { createAudioPlayer } from './audio'
import {
  hasAudioContext,
  releaseAudioContext,
  sharedAudioContext,
} from './context'
import { installFakeAudioContext } from '../../testing/fakeAudioContext'
import type { ReferenceNote } from '../../data/notes.generated'
import type { Root } from '../../types'

/**
 * The voice is driven with a fixture rather than the generated module: what is
 * under test is the voice, and a test that reads `notes.generated.ts` would
 * fail on a re-render that changed nothing about playback.
 */
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

/** Twelve entries, one per root, named by an ASCII slug as the render is. */
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

// Step C3 — R1, R17, AC1: a tap fetches, decodes and starts one node.
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
    expect(node.connect).toHaveBeenCalledWith(fake.contexts[0].destination)
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

// Step C4 — R17, AC14: a root is fetched and decoded at most once.
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

// Step C5 — R5, AC4: at most one reference note sounds at a time.
describe('a new note takes the voice from the ringing one (R5, AC4)', () => {
  it('stops the previous node and leaves the new one ringing', async () => {
    const fake = installFakeAudioContext()
    const voice = createReferenceVoice(TWO)

    await voice.play('C')
    await voice.play('D')

    expect(fake.sources).toHaveLength(2)
    expect(fake.sources[0].stop).toHaveBeenCalledTimes(1)
    expect(fake.sources[0].disconnect).toHaveBeenCalledTimes(1)
    expect(fake.sources[1].stop).not.toHaveBeenCalled()
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

// Step C6 — R10, R11, AC8, AC9: every failure is swallowed.
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

// Step C7 — R18, R19a: warming fetches everything and sounds nothing.
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

    // Eleven sounded, none of them refetched.
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

// Step C8 — R13, R16: disposing stops the note and keeps the context.
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

/**
 * AC13, as the criterion actually states it. Two halves of this are already
 * asserted apart — `audio.test.ts` proves disposing the player leaves the
 * context open, and the suite above proves the voice plays through a shared
 * context — but nothing composed them. A regression that closed the context on
 * some later path would leave both of those green while the scenario the AC
 * describes, dispose the player and then tap a root, was broken.
 */
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

    // A node beyond the groove's own, started, on the one surviving context.
    expect(fake.sources.length).toBeGreaterThan(groovePlayed)
    const note = fake.sources[fake.sources.length - 1]
    expect(note.loop).toBe(false)
    expect(note.start).toHaveBeenCalledTimes(1)
    expect(fake.contexts).toHaveLength(1)
    expect(fake.contexts[0].state).not.toBe('closed')

    voice.dispose()
  })
})
