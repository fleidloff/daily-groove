import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import type { Root } from '../types'
import type { ReferenceNote } from '../data/notes.generated'
import { useReferenceNote } from './useReferenceNote'

/**
 * Two notes are enough: the hook routes a root at the voice and owns the
 * voice's lifetime. Which files exist is `notes.generated.ts`'s business.
 */
const NOTES: ReferenceNote[] = [
  { root: 'C', audioSrc: '/notes/note-c.mp3', midi: 60 },
  { root: 'E♭', audioSrc: '/notes/note-e-flat.mp3', midi: 63 },
]

/**
 * A stand-in `ReferenceVoice`, injected the way `useSimpleMode` takes a
 * `PreferenceStore`. The seam is the hook's own parameter, so no test here
 * reaches past `lib/audio/reference.ts`'s public shape — nor needs it to exist.
 */
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
  // --- Step D1: the hook owns the voice's lifetime (R1, R14) ---------------

  it('asks the voice for the root it is given (R1)', () => {
    const voice = makeVoice()
    const { result } = renderHook(() => useReferenceNote(NOTES, voice))

    act(() => {
      result.current.playRoot('C')
    })

    expect(voice.play).toHaveBeenCalledTimes(1)
    expect(voice.play).toHaveBeenCalledWith('C')
  })

  it('disposes the voice exactly once on unmount (R13, R14)', () => {
    const voice = makeVoice()
    const { unmount } = renderHook(() => useReferenceNote(NOTES, voice))

    expect(voice.dispose).not.toHaveBeenCalled()
    unmount()
    expect(voice.dispose).toHaveBeenCalledTimes(1)
  })

  it('keeps one voice across re-renders and disposes nothing in between', () => {
    const voice = makeVoice()
    const { result, rerender } = renderHook(() => useReferenceNote(NOTES, voice))
    const first = result.current.playRoot

    rerender()
    rerender()

    expect(voice.dispose).not.toHaveBeenCalled()
    // A stable callback, so the card below it is not re-rendered on every tick.
    expect(result.current.playRoot).toBe(first)
  })

  it('warms through the same voice without sounding anything (R18)', () => {
    const voice = makeVoice()
    const { result } = renderHook(() => useReferenceNote(NOTES, voice))

    act(() => {
      result.current.warm()
    })

    expect(voice.warm).toHaveBeenCalledTimes(1)
    expect(voice.play).not.toHaveBeenCalled()
  })

  // --- Step D4: a voice that fails costs the caller nothing (R9, R10, AC8) --

  it('returns nothing and rejects nothing when the voice rejects (R9, R10)', async () => {
    const voice = makeVoice({
      play: vi.fn(async () => {
        throw new Error('no Web Audio')
      }),
    })
    const { result } = renderHook(() => useReferenceNote(NOTES, voice))

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
    const { result } = renderHook(() => useReferenceNote(NOTES, voice))

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
    const { result } = renderHook(() => useReferenceNote(NOTES, voice))

    await act(async () => {
      result.current.warm()
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(voice.warm).toHaveBeenCalledTimes(1)
  })
})
