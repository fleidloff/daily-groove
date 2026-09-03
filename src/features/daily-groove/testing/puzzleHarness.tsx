import type { ReactElement } from 'react'
import { expect, vi, type Mock } from 'vitest'
import { act, render, screen, waitFor, within } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import type { Answer, Attempt, DailyResult, Groove, Root } from '../types'
import { flavourOptions, flavourPool } from '@/lib/theory/music'
import { barChords } from '@/lib/theory/changes'
import { isoDate } from '@/lib/date'
import { FAMILIES } from '@/lib/theory/families'
import { ROOTS } from '@/lib/theory/roots'
import { coaching, puzzle } from '@/lib/snippets'
import { GROOVES } from '../data/grooves.generated'
import { createLocalStore } from '../lib/persistence/storage'
import {
  createLocalPreferenceStore,
  type Preferences,
} from '../lib/persistence/preferences'
import {
  installFakeAudioContext,
  type FakeContext,
  type FakeSourceNode,
} from './fakeAudioContext'

export const GROOVE: Groove = {
  id: 'groove-01',
  uuid: '61607a6c-3f9e-4fd7-9724-99ea22d32e4a',
  audioSrc: '/grooves/groove-01.mp3',
  name: 'Test Groove',
  bpm: 90,
  root: 'C',
  flavour: 'Aeolian',
  bars: 4,
  scale: 'C Aeolian',
  chord: 'Cm7',
  progression: 'Cm–Fm–G7',
  headDelaySeconds: 0.025057,
}

export const CHANGES_READ = barChords(GROOVE.progression).join(' · ')

export const ANSWER: Answer = { root: 'C', flavour: 'Aeolian' }

export const flavours = () => flavourOptions(new Date(), GROOVE, GROOVES)
export const wrongFlavour = () => flavours().find((f) => f !== 'Aeolian') as string
export const otherWrongFlavour = () =>
  flavours().filter((f) => f !== 'Aeolian' && f !== wrongFlavour())[0]
export const thirdWrongFlavour = () =>
  flavours().filter(
    (f) => f !== 'Aeolian' && f !== wrongFlavour() && f !== otherWrongFlavour(),
  )[0]

export const TODAY = () => isoDate(new Date())

export function clearStored(): void {
  localStorage.clear()
}

export function storedDay(over: Partial<DailyResult> = {}): DailyResult {
  return {
    date: TODAY(),
    answer: ANSWER,
    attempts: [],
    solved: false,
    grooveId: GROOVE.id,
    ...over,
  }
}

export async function seedDay(result: DailyResult): Promise<void> {
  await createLocalStore().save(result)
}

export async function seedPreferences(
  patch: Partial<Preferences>,
): Promise<void> {
  await createLocalPreferenceStore().update(patch)
}

export async function seedFullSet(): Promise<void> {
  await seedPreferences({ simpleMode: false })
}

export function miss(root: Root, flavour: string, rootMatched: boolean): Attempt {
  return { root, flavour, correct: false, rootMatched, flavourMatched: false }
}

export const SOLVING: Attempt = {
  root: 'C',
  flavour: 'Aeolian',
  correct: true,
  rootMatched: true,
  flavourMatched: true,
}

export const GROOVE_LOOP_SECONDS = (4 * 4 * 60) / 90

export type MockStore = {
  get: Mock
  getAll: Mock
  save: Mock
}

export function createMockStore(): MockStore {
  return {
    get: vi.fn(),
    getAll: vi.fn(),
    save: vi.fn(),
  }
}

export function resetMockStore(store: MockStore): void {
  store.get.mockReset().mockResolvedValue(null)
  store.getAll.mockReset().mockResolvedValue([])
  store.save.mockReset().mockResolvedValue(undefined)
}

let fake: FakeContext
let frame: () => void

function installFrames() {
  const pending = new Map<number, FrameRequestCallback>()
  let nextId = 1

  vi.stubGlobal('requestAnimationFrame', (fn: FrameRequestCallback) => {
    const id = nextId
    nextId += 1
    pending.set(id, fn)
    return id
  })
  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    pending.delete(id)
  })

  return function runFrame() {
    const due = Array.from(pending.entries())
    pending.clear()
    for (const [, fn] of due) fn(0)
  }
}

export function installPuzzleAudio(): { fake: FakeContext; frame: () => void } {
  frame = installFrames()
  fake = installFakeAudioContext({ bufferSeconds: GROOVE_LOOP_SECONDS + 0.1 })
  return { fake, frame }
}

export function teardownPuzzleAudio(): void {
  vi.unstubAllGlobals()
}

export const soundedNotes = async (count: number) => {
  await waitFor(() => expect(fake.sources).toHaveLength(count))
  return fake.sources
}

export const startedAt = (node: FakeSourceNode) =>
  (node.start.mock.calls[0] as [number])[0]

export const loopFraction = (fraction: number) => GROOVE_LOOP_SECONDS * fraction

export async function advance(seconds: number) {
  fake.advance(seconds)
  await act(async () => {
    frame()
  })
}

export async function play(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: puzzle.playName.play }))
  await screen.findByRole('button', { name: puzzle.playName.stop })
}

export async function settle() {
  await act(async () => {
    await Promise.resolve()
    await Promise.resolve()
    await Promise.resolve()
  })
}

export async function renderPuzzle(ui?: ReactElement) {
  const { GroovePuzzle } = await import('../components/GroovePuzzle')
  const result = render(ui ?? <GroovePuzzle groove={GROOVE} />)
  await settle()
  return result
}

export const NOTE_GLYPH = '♪'

export const chipLabel = (chip: Element) =>
  Array.from(chip.childNodes)
    .filter(
      (node) =>
        !(node instanceof Element && node.getAttribute('aria-hidden') === 'true'),
    )
    .map((node) => node.textContent ?? '')
    .join('')

export const chipAdornment = (chip: Element) =>
  chip.querySelector('[aria-hidden="true"]')?.textContent ?? null

const CONTROL_NAMES = new Set<string>([
  coaching.checkSolved,
  coaching.checkRevealed,
  coaching.pickRoot,
  coaching.pickMode,
  coaching.pickRootAndMode,
  ...ROOTS.flatMap((root) =>
    [...flavourPool(GROOVES), ...FAMILIES].map((flavour) =>
      coaching.checkPair({ root, flavour }),
    ),
  ),
])

const RULED_OUT_LINES = new Set<string>(
  ROOTS.map((_, index) => puzzle.ruledOut({ roots: index + 1 })),
)

export const rootGroup = () =>
  screen.getByRole('radiogroup', { name: puzzle.rootGroup })
export const flavourGroup = () =>
  screen.getByRole('radiogroup', { name: puzzle.modeGroup })
export const control = () =>
  screen.getByRole('button', { name: (name) => CONTROL_NAMES.has(name) })
export const nudge = () =>
  screen.queryByRole('complementary', { name: puzzle.hint })
export const nudgeLine = () =>
  screen.queryByText((text) => RULED_OUT_LINES.has(text))
export const hintRegion = () => nudge()?.querySelector('[role="status"]') ?? null
export const verdictLine = () => nudge()?.querySelector('[data-tone="warm"]') ?? null
export const coachingLine = () =>
  nudge()?.querySelector('[data-tone="neutral"]') ?? null
export const move = () => coachingLine()?.textContent ?? null

export async function guess(
  user: ReturnType<typeof userEvent.setup>,
  root: string,
  flavour: string,
) {
  await user.click(within(rootGroup()).getByRole('button', { name: root }))
  await user.click(within(flavourGroup()).getByRole('button', { name: flavour }))
  await user.click(control())
}
