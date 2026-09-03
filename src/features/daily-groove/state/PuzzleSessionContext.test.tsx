import { beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, renderHook, screen, waitFor } from '@testing-library/react'
import { clearStored, GROOVE } from '../testing/puzzleHarness'
import {
  usePuzzleSession,
  type UsePuzzleSession,
} from '../hooks/usePuzzleSession'
import {
  PuzzleSessionProvider,
  usePuzzleSessionContext,
  type PuzzleSessionValue,
} from './PuzzleSessionContext'

const DATE = new Date(2026, 7, 29, 12, 0, 0)

let reads: PuzzleSessionValue[] = []

function Probe({ name }: { name: string }) {
  const value = usePuzzleSessionContext()
  reads.push(value)
  return (
    <p data-testid={name}>
      {`${value.groove.name} · ${value.today.toISOString()} · simple ${
        value.simple ? 'on' : 'off'
      } · taps ${value.tapSounds ? 'on' : 'off'}`}
    </p>
  )
}

async function aSession() {
  const { result } = renderHook(() => usePuzzleSession(GROOVE, DATE))
  await waitFor(() => expect(result.current.hydrated).toBe(true))
  return result.current
}

function aValue(session: PuzzleSessionValue['session']): PuzzleSessionValue {
  return {
    groove: GROOVE,
    today: DATE,
    session,
    simple: true,
    setSimple: vi.fn(),
    tapSounds: false,
    setTapSounds: vi.fn(),
  }
}

describe('the puzzle session context', () => {
  beforeEach(() => {
    clearStored()
    reads = []
  })

  it('throws rather than returning a default outside the provider (R4c, AC4b)', () => {
    expect(() => renderHook(() => usePuzzleSessionContext())).toThrow(
      /must be used inside <PuzzleSessionProvider>/,
    )
  })

  it('creates one store for the mount and reuses it on every render (R4a, AC4a)', async () => {
    const stores = new Set<UsePuzzleSession['selectRoot']>()
    let renders = 0

    const mount = () =>
      renderHook(
        ({ simple }: { simple: boolean }) => {
          const session = usePuzzleSession(GROOVE, DATE, simple)
          renders += 1
          stores.add(session.selectRoot)
          return session
        },
        { initialProps: { simple: false } },
      )

    const { result, rerender } = mount()
    await waitFor(() => expect(result.current.hydrated).toBe(true))
    expect(stores.size).toBe(1)

    act(() => {
      result.current.selectRoot('E♭')
    })
    rerender({ simple: true })
    rerender({ simple: false })

    expect(renders).toBeGreaterThan(3)
    expect(stores.size).toBe(1)
    expect(result.current.selectedRoot).toBe('E♭')
    expect(result.current.hydrated).toBe(true)

    const next = mount()
    await waitFor(() => expect(next.result.current.hydrated).toBe(true))
    expect(stores.size).toBe(2)
    expect(next.result.current.selectedRoot).toBeNull()
  })

  it('hands every consumer under one provider the same instance (R4b, AC4a)', async () => {
    const value = aValue(await aSession())

    render(
      <PuzzleSessionProvider value={value}>
        <Probe name="first" />
        <Probe name="second" />
      </PuzzleSessionProvider>,
    )

    expect(screen.getByTestId('first')).toHaveTextContent('Test Groove')
    expect(screen.getByTestId('second')).toHaveTextContent('Test Groove')
    expect(reads).toHaveLength(2)
    expect(Object.is(reads[0], reads[1])).toBe(true)
    expect(reads[0]).toBe(value)
    expect(reads[1]).toBe(value)
  })

  it('carries the groove, the day, the session and both settings (R4a, R4b)', async () => {
    const session = await aSession()
    const value = aValue(session)

    render(
      <PuzzleSessionProvider value={value}>
        <Probe name="only" />
      </PuzzleSessionProvider>,
    )

    expect(screen.getByTestId('only')).toHaveTextContent(
      `Test Groove · ${DATE.toISOString()} · simple on · taps off`,
    )

    const read = reads[0]
    expect(read.groove).toBe(GROOVE)
    expect(read.today).toBe(DATE)
    expect(read.session.answer).toEqual({ root: 'C', flavour: 'Aeolian' })
    expect(read.session.selectRoot).toBe(session.selectRoot)
    expect(read.session.selectFlavour).toBe(session.selectFlavour)
    expect(read.session.check).toBe(session.check)
    expect(read.session.reveal).toBe(session.reveal)
    expect(read.simple).toBe(true)
    expect(read.setSimple).toBe(value.setSimple)
    expect(read.tapSounds).toBe(false)
    expect(read.setTapSounds).toBe(value.setTapSounds)
  })
})
