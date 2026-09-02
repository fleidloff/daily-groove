import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { Root } from '../types'
import type { ReferenceNote } from '../data/notes.generated'
import { releaseAudioContext } from '../lib/audio/context'
import { installFakeAudioContext } from '../testing/fakeAudioContext'
import { useReferenceNote } from './useReferenceNote'

const NOTES: ReferenceNote[] = [
  { root: 'C', audioSrc: '/notes/note-c.mp3', midi: 60 },
  { root: 'E♭', audioSrc: '/notes/note-e-flat.mp3', midi: 63 },
]

function makeClock() {
  return {
    nextBeat: vi.fn<(now: number) => number | null>(() => null),
    isRunning: vi.fn(() => false),
    subscribe: vi.fn(() => () => {}),
  }
}

function makeVoice(overrides: Partial<ReturnType<typeof baseVoice>> = {}) {
  return { ...baseVoice(), ...overrides }
}

function baseVoice() {
  return {
    play: vi.fn(async (root: Root) => {
      void root
    }),
    warm: vi.fn(async () => {}),
    dispose: vi.fn(() => {}),
  }
}

describe('useReferenceNote', () => {
  afterEach(() => {
    void releaseAudioContext()
    vi.unstubAllGlobals()
  })

  it('asks the voice for the root it is given (R1)', () => {
    const voice = makeVoice()
    const { result } = renderHook(() => useReferenceNote(NOTES, { voice }))

    act(() => {
      result.current.playRoot('C')
    })

    expect(voice.play).toHaveBeenCalledTimes(1)
    expect(voice.play).toHaveBeenCalledWith('C')
  })

  it('disposes the voice exactly once on unmount (R13, R14)', () => {
    const voice = makeVoice()
    const { unmount } = renderHook(() => useReferenceNote(NOTES, { voice }))

    expect(voice.dispose).not.toHaveBeenCalled()
    unmount()
    expect(voice.dispose).toHaveBeenCalledTimes(1)
  })

  it('keeps one voice across re-renders and disposes nothing in between', () => {
    const voice = makeVoice()
    const { result, rerender } = renderHook(() => useReferenceNote(NOTES, { voice }))
    const first = result.current.playRoot

    rerender()
    rerender()

    expect(voice.dispose).not.toHaveBeenCalled()
    expect(result.current.playRoot).toBe(first)
  })

  it('warms through the same voice without sounding anything (R18)', () => {
    const voice = makeVoice()
    const { result } = renderHook(() => useReferenceNote(NOTES, { voice }))

    act(() => {
      result.current.warm()
    })

    expect(voice.warm).toHaveBeenCalledTimes(1)
    expect(voice.play).not.toHaveBeenCalled()
  })

  it('builds its voice with the grid it was given (R6)', async () => {
    const fake = installFakeAudioContext()
    const clock = makeClock()
    const { result } = renderHook(() => useReferenceNote(NOTES, { clock }))

    await act(async () => {
      result.current.playRoot('C')
    })

    await waitFor(() => {
      expect(clock.nextBeat).toHaveBeenCalledWith(fake.currentTime)
    })
  })

  it('returns nothing and rejects nothing when the voice rejects (R9, R10)', async () => {
    const voice = makeVoice({
      play: vi.fn(async () => {
        throw new Error('no Web Audio')
      }),
    })
    const { result } = renderHook(() => useReferenceNote(NOTES, { voice }))

    let returned: unknown = 'not called'
    await act(async () => {
      returned = result.current.playRoot('C')
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(returned).toBeUndefined()
    expect(voice.play).toHaveBeenCalledWith('C')
  })

  it('survives a voice that throws synchronously (R9, R10)', () => {
    const voice = makeVoice({
      play: vi.fn(() => {
        throw new Error('no Web Audio')
      }),
    })
    const { result } = renderHook(() => useReferenceNote(NOTES, { voice }))

    expect(() =>
      act(() => {
        result.current.playRoot('C')
      }),
    ).not.toThrow()
  })

  it('survives a warm that rejects (R18, R19a)', async () => {
    const voice = makeVoice({
      warm: vi.fn(async () => {
        throw new Error('offline')
      }),
    })
    const { result } = renderHook(() => useReferenceNote(NOTES, { voice }))

    await act(async () => {
      result.current.warm()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(voice.warm).toHaveBeenCalledTimes(1)
  })
})
