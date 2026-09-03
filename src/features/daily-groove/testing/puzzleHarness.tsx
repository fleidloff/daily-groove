import type { ReactElement } from 'react'
import { vi, type Mock } from 'vitest'
import { act, render, screen, within } from '@testing-library/react'
import type userEvent from '@testing-library/user-event'
import type { Attempt, Groove, Root } from '../types'
import { flavourOptions } from '../lib/theory/music'
import { isoDate } from '../lib/puzzle/selectGroove'
import {
  installFakeAudioContext,
  type FakeContext,
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

export const CHANGES_READ = 'Cm · Fm · G7 · Cm'

export const flavours = () => flavourOptions(new Date(), GROOVE)
export const wrongFlavour = () => flavours().find((f) => f !== 'Aeolian') as string
export const otherWrongFlavour = () =>
  flavours().filter((f) => f !== 'Aeolian' && f !== wrongFlavour())[0]
export const thirdWrongFlavour = () =>
  flavours().filter(
    (f) => f !== 'Aeolian' && f !== wrongFlavour() && f !== otherWrongFlavour(),
  )[0]

export const TODAY = () => isoDate(new Date())

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

export const loopFraction = (fraction: number) => GROOVE_LOOP_SECONDS * fraction

export async function advance(seconds: number) {
  fake.advance(seconds)
  await act(async () => {
    frame()
  })
}

export async function play(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Play the loop' }))
  await screen.findByRole('button', { name: 'Stop the loop' })
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

export const CAPTION =
  'Find the note that feels like home — Play along with your instrument, or tap a root or a mode to hear it.'

export const CAPTION_SOUNDS_OFF =
  'Find the note that feels like home — Play along with your instrument.'

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

export const rootGroup = () => screen.getByRole('radiogroup', { name: 'Root' })
export const flavourGroup = () => screen.getByRole('radiogroup', { name: 'Mode' })
export const control = () =>
  screen.getByRole('button', { name: /^(Pick a |Check |Solved$)/ })
export const nudge = () => screen.queryByRole('complementary', { name: 'Hint' })
export const nudgeLine = () => screen.queryByText(/roots ruled out/i)
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
