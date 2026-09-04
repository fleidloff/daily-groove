'use client'

import { createContext, useContext, type ReactNode } from 'react'
import type { Written } from '@/lib/theory/transpose'
import type { Groove } from '../types'
import type { UsePuzzleSession } from '../hooks/usePuzzleSession'

export type PuzzleSessionValue = {
  groove: Groove
  today: Date
  session: UsePuzzleSession
  simple: boolean
  setSimple(simple: boolean): void
  tapSounds: boolean
  setTapSounds(on: boolean): void
  written: Written
  setWritten(written: Written): void
}

const PuzzleSession = createContext<PuzzleSessionValue | null>(null)

export function PuzzleSessionProvider(props: {
  value: PuzzleSessionValue
  children: ReactNode
}): ReactNode {
  return <PuzzleSession value={props.value}>{props.children}</PuzzleSession>
}

export function usePuzzleSessionContext(): PuzzleSessionValue {
  const value = useContext(PuzzleSession)
  if (value === null) {
    throw new Error(
      'usePuzzleSessionContext must be used inside <PuzzleSessionProvider>',
    )
  }
  return value
}
