import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { Flavour } from '../types'
import type { PitchSample } from '../data/notes.generated'
import { releaseAudioContext } from '../lib/audio/context'
import { REFERENCE_FADE_SECONDS, REFERENCE_LEVEL } from '../lib/audio/level'
import { referenceOutput } from '../lib/audio/output'
import type { LickVoice, ReferenceOutput } from '../lib/audio/lick'
import { scheduleLick, type ScheduledNote } from '../lib/theory/phrase'
import { ROOTS, flavourPool } from '../lib/theory/music'
import { GROOVES } from '../data/grooves.generated'
import { installFakeAudioContext } from '../testing/fakeAudioContext'
import { useModeLick } from './useModeLick'

const POOL = flavourPool(GROOVES)

const PITCHES: PitchSample[] = ROOTS.flatMap((root, index) =>
  [4, 5].map((octave) => ({
    id: `${root}${octave}`,
    root,
    octave,
    midi: 60 + index + (octave - 4) * 12,
    audioSrc: `/notes/note-${index}-${octave}.mp3`,
  })),
).sort((a, b) => a.midi - b.midi)

function makeClock(beat: number | null = null) {
  return { nextBeat: vi.fn<(now: number) => number | null>(() => beat) }
}

function makeVoice(overrides: Partial<LickVoice> = {}): LickVoice {
  return {
    play: vi.fn(async (notes: ScheduledNote[]) => {
      void notes
    }),
    warm: vi.fn(async () => {}),
    dispose: vi.fn(() => {}),
    ...overrides,
  }
}

function inputs(extra: {
  voice?: LickVoice
  clock?: { nextBeat: (now: number) => number | null }
  output?: ReferenceOutput
}) {
  return {
    pitches: PITCHES,
    root: 'C' as const,
    bpm: 96,
    level: REFERENCE_LEVEL,
    fadeSeconds: REFERENCE_FADE_SECONDS,
    output: extra.output ?? referenceOutput(),
    clock: extra.clock,
    voice: extra.voice,
  }
}

describe('useModeLick', () => {
  afterEach(async () => {
    await releaseAudioContext()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('keeps one voice across re-renders and disposes nothing in between', () => {
    const voice = makeVoice()
    const { result, rerender } = renderHook(() => useModeLick(inputs({ voice })))
    const first = result.current.playMode

    rerender()
    rerender()
    rerender()

    expect(voice.dispose).not.toHaveBeenCalled()
    expect(result.current.playMode).toBe(first)
  })

  it('disposes the voice exactly once on unmount (R32)', () => {
    const voice = makeVoice()
    const { unmount } = renderHook(() => useModeLick(inputs({ voice })))

    expect(voice.dispose).not.toHaveBeenCalled()
    unmount()
    expect(voice.dispose).toHaveBeenCalledTimes(1)
  })

  it('hands the voice exactly the phrase scheduleLick names (R1, R13)', () => {
    const voice = makeVoice()
    const { result } = renderHook(() => useModeLick(inputs({ voice })))

    act(() => {
      result.current.playMode('Lydian')
    })

    expect(voice.play).toHaveBeenCalledTimes(1)
    expect(voice.play).toHaveBeenCalledWith(
      scheduleLick({ flavour: 'Lydian', root: 'C', bpm: 96 }),
    )
  })

  it('plays every catalogue flavour, and no two the same (AC4)', () => {
    const voice = makeVoice()
    const { result } = renderHook(() => useModeLick(inputs({ voice })))

    POOL.forEach((flavour) => {
      act(() => {
        result.current.playMode(flavour)
      })
    })

    const play = voice.play as unknown as ReturnType<typeof vi.fn>
    expect(play).toHaveBeenCalledTimes(POOL.length)

    const phrases = play.mock.calls.map((call) => call[0] as ScheduledNote[])
    phrases.forEach((phrase, index) => {
      expect(phrase.length, POOL[index]).toBeGreaterThan(0)
    })
    expect(new Set(phrases.map((p) => JSON.stringify(p))).size).toBe(POOL.length)
  })

  it('asks the voice for nothing when the mode has no lick (R19, R20)', () => {
    const voice = makeVoice()
    const { result } = renderHook(() => useModeLick(inputs({ voice })))

    act(() => {
      result.current.playMode('Locrian' as Flavour)
    })

    expect(voice.play).not.toHaveBeenCalled()
  })

  it('builds its voice with the clock it was given (R11, R12)', async () => {
    const fake = installFakeAudioContext()
    const clock = makeClock()
    const { result } = renderHook(() => useModeLick(inputs({ clock })))

    await act(async () => {
      result.current.playMode('Dorian')
    })

    await waitFor(() => {
      expect(clock.nextBeat).toHaveBeenCalledTimes(1)
    })
    expect(clock.nextBeat).toHaveBeenCalledWith(fake.currentTime)
  })

  it('keeps the first clock when a later render brings another (R14)', async () => {
    installFakeAudioContext()
    const first = makeClock()
    const second = makeClock(4.25)
    const { result, rerender } = renderHook(
      (clock: { nextBeat: (now: number) => number | null }) =>
        useModeLick(inputs({ clock })),
      { initialProps: first as { nextBeat: (now: number) => number | null } },
    )

    await act(async () => {
      result.current.playMode('Dorian')
    })
    await waitFor(() => {
      expect(first.nextBeat).toHaveBeenCalledTimes(1)
    })

    rerender(second as { nextBeat: (now: number) => number | null })

    await act(async () => {
      result.current.playMode('Aeolian')
    })
    await waitFor(() => {
      expect(first.nextBeat).toHaveBeenCalledTimes(2)
    })
    expect(second.nextBeat).not.toHaveBeenCalled()
  })

  it('reads no transport of its own (R14)', () => {
    const source = readFileSync(
      join(process.cwd(), 'src/features/daily-groove/hooks/useModeLick.ts'),
      'utf8',
    )

    const specifiers = [...source.matchAll(/from '([^']+)'/g)].map((m) => m[1])
    specifiers.forEach((specifier) => {
      expect(specifier, specifier).not.toMatch(/transport|loop|useTransport/)
    })
    ;['getElapsed', 'getPosition', 'getStartTime', 'toggle'].forEach((name) => {
      expect(source, name).not.toContain(name)
    })
  })

  it('returns undefined and rejects nothing when play rejects (R19, R20)', async () => {
    const voice = makeVoice({
      play: vi.fn(async () => {
        throw new Error('no Web Audio')
      }),
    })
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {})
    const rejections: unknown[] = []
    const onRejection = (reason: unknown) => rejections.push(reason)
    process.on('unhandledRejection', onRejection)

    const { result } = renderHook(() => useModeLick(inputs({ voice })))

    let returned: unknown = 'not called'
    await act(async () => {
      returned = result.current.playMode('Dorian')
      await Promise.resolve()
      await Promise.resolve()
    })
    await new Promise((resolve) => setImmediate(resolve))
    process.off('unhandledRejection', onRejection)

    expect(returned).toBeUndefined()
    expect(voice.play).toHaveBeenCalledTimes(1)
    expect(rejections).toEqual([])
    expect(errors).not.toHaveBeenCalled()
  })

  it('survives a play that throws synchronously (R19, AC14)', () => {
    const voice = makeVoice({
      play: vi.fn(() => {
        throw new Error('boom')
      }) as unknown as LickVoice['play'],
    })
    const { result } = renderHook(() => useModeLick(inputs({ voice })))

    expect(() =>
      act(() => {
        result.current.playMode('Dorian')
      }),
    ).not.toThrow()
  })

  it('warms through the same voice without sounding anything (R33)', () => {
    const voice = makeVoice()
    const { result } = renderHook(() => useModeLick(inputs({ voice })))

    act(() => {
      result.current.warm()
    })

    expect(voice.warm).toHaveBeenCalledTimes(1)
    expect(voice.play).not.toHaveBeenCalled()
  })

  it('survives a warm that rejects (R33)', async () => {
    const voice = makeVoice({
      warm: vi.fn(async () => {
        throw new Error('offline')
      }),
    })
    const { result } = renderHook(() => useModeLick(inputs({ voice })))

    await act(async () => {
      result.current.warm()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(voice.warm).toHaveBeenCalledTimes(1)
  })

  it('fetches nothing until something asks it to (R34)', async () => {
    const fake = installFakeAudioContext()
    renderHook(() => useModeLick(inputs({ clock: makeClock() })))

    await act(async () => {
      await Promise.resolve()
    })

    expect(fake.fetchCalls).toBe(0)
    expect(fake.decodeCalls).toBe(0)
  })
})
