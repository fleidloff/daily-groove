import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Root } from '../types'
import { ROOTS } from '@/lib/theory/roots'
import { simpleRootOptions } from '@/lib/theory/music'
import { WRITTEN, writtenRoot, type Written } from '@/lib/theory/transpose'
import { coaching, header, puzzle, solved } from '@/lib/snippets'
import { NOTES, type ReferenceNote } from '../data/notes.generated'
import { createLocalStore } from '../lib/persistence/storage'
import { createLocalPreferenceStore } from '../lib/persistence/preferences'
import {
  ANSWER,
  chipLabel,
  clearStored,
  control,
  flavourGroup,
  GROOVE,
  guess,
  installPuzzleAudio,
  move,
  nudgeLine,
  otherWrongFlavour,
  renderPuzzle,
  rootGroup,
  seedFullSet,
  seedPreferences,
  soundedNotes,
  teardownPuzzleAudio,
  wrongFlavour,
} from '../testing/puzzleHarness'
import { GroovePuzzle } from './GroovePuzzle'

const transposeBox = () =>
  screen.getByRole('combobox', { name: header.transpose })
const pick = (user: ReturnType<typeof userEvent.setup>, written: Written) =>
  user.selectOptions(transposeBox(), written)
const toAlto = (user: ReturnType<typeof userEvent.setup>) => pick(user, 'E♭')
const rootChips = () => within(rootGroup()).getAllByRole('button')
const rootLabels = () => rootChips().map(chipLabel)
const dimmed = () =>
  rootChips()
    .filter((chip) => chip.getAttribute('aria-disabled') === 'true')
    .map(chipLabel)
const pressed = () =>
  rootChips()
    .filter((chip) => chip.getAttribute('aria-pressed') === 'true')
    .map(chipLabel)
const grooveCard = () =>
  screen.getByRole('heading', { name: GROOVE.name }).parentElement as HTMLElement
const card = () => rootGroup().closest('div.rounded-card') as HTMLElement
const fetchedNotes = () =>
  (globalThis.fetch as unknown as Mock).mock.calls
    .map(([url]) => String(url))
    .filter((url) => url.startsWith('/notes/'))
const noteSrc = (root: string) =>
  (NOTES.find((note) => note.root === root) as ReferenceNote).audioSrc
const ALTO = (root: Root) => writtenRoot(root, 'E♭')

describe('GroovePuzzle — written pitch', () => {
  beforeEach(async () => {
    clearStored()
    await seedFullSet()
    installPuzzleAudio()
  })

  afterEach(() => {
    teardownPuzzleAudio()
  })

  it('sits in the header beside share and the streak, reading Transpose, before, during and after the puzzle (R1, AC1, AC3)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    const box = transposeBox()
    expect(box).toHaveValue('C')
    expect(box.closest('header')).not.toBeNull()
    const anchor = screen
      .getByLabelText(header.currentStreakName)
      .closest('.self-end') as HTMLElement
    expect(anchor).toContainElement(box)
    expect(anchor).toContainElement(
      screen.getByRole('button', { name: header.share }),
    )
    expect(within(grooveCard()).queryByRole('combobox')).toBeNull()

    await guess(user, 'G', wrongFlavour())
    expect(transposeBox()).toHaveValue('C')
    await guess(user, 'C', 'Aeolian')
    expect(transposeBox()).toHaveValue('C')
    expect(transposeBox()).not.toBeDisabled()
  })

  it('is offered on a shared groove too (R1, AC1)', async () => {
    await renderPuzzle(<GroovePuzzle groove={GROOVE} mode="shared" />)
    expect(transposeBox()).toHaveValue('C')
  })

  it('offers the four keys and the root chips follow whichever is picked (R1, AC1b)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    expect(
      within(transposeBox()).getAllByRole('option').map((o) => o.textContent),
    ).toEqual(WRITTEN.map((w) => header.instruments[w]))
    expect(rootLabels()).toEqual([...ROOTS])
    for (const written of WRITTEN) {
      await pick(user, written)
      expect(transposeBox()).toHaveValue(written)
      expect(rootLabels()).toEqual(ROOTS.map((r) => writtenRoot(r, written)))
    }
  })

  it('relabels the chips and leaves the sound alone: the chip an alto player reads as C plays concert E♭ (R5, R6, AC6, AC7)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    await toAlto(user)
    expect(rootLabels()).toEqual(ROOTS.map(ALTO))

    await user.click(within(rootGroup()).getByRole('button', { name: ALTO('E♭') }))
    expect(pressed()).toEqual([ALTO('E♭')])
    const [note] = await soundedNotes(1)
    expect(fetchedNotes()).toEqual([noteSrc('E♭')])
    expect(note.start).toHaveBeenCalledTimes(1)
  })

  it('solves the day from the written chip and the right mode (R6, AC8)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    await toAlto(user)
    await guess(user, ALTO(GROOVE.root), 'Aeolian')
    expect(screen.getByRole('status')).toBeInTheDocument()
    expect(
      screen.getByRole('group', { name: solved.notesToLiveIn }),
    ).toBeInTheDocument()
  })

  it('names the written root in Check and the meta line, and switches both back in place (R7, AC9)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    await toAlto(user)
    const root = ALTO(GROOVE.root)
    await user.click(within(rootGroup()).getByRole('button', { name: root }))
    await user.click(within(flavourGroup()).getByRole('button', { name: 'Aeolian' }))
    expect(control()).toHaveAccessibleName(
      coaching.checkPair({ root, flavour: 'Aeolian' }),
    )
    await user.click(control())

    expect(grooveCard()).toHaveTextContent(`${root} Aeolian`)
    expect(grooveCard()).not.toHaveTextContent(`${GROOVE.root} Aeolian`)

    await pick(user, 'C')
    expect(grooveCard()).toHaveTextContent(`${GROOVE.root} Aeolian`)
    expect(grooveCard()).not.toHaveTextContent(`${root} Aeolian`)
    expect(control()).toHaveAccessibleName(coaching.checkSolved)
  })

  it('relabels every chip, ruled-out and selected included, and touches no attempt, no coaching, no other preference (R8, R10, AC10, AC12)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    await guess(user, 'G', wrongFlavour())
    await guess(user, 'D', otherWrongFlavour())
    const dimmedBefore = dimmed()
    expect(dimmedBefore.length).toBeGreaterThanOrEqual(2)
    const moveBefore = move()
    const countBefore = nudgeLine()?.textContent ?? null
    await user.click(within(rootGroup()).getByRole('button', { name: 'E' }))
    await user.click(within(flavourGroup()).getByRole('button', { name: 'Aeolian' }))
    const attemptsBefore = (await createLocalStore().getAll())[0].attempts

    await toAlto(user)

    expect(dimmed()).toEqual(dimmedBefore.map((r) => ALTO(r as Root)))
    expect(pressed()).toEqual([ALTO('E')])
    expect(move()).toBe(moveBefore)
    expect(nudgeLine()?.textContent ?? null).toBe(countBefore)
    expect(control()).toBeEnabled()
    expect(control()).toHaveAccessibleName(
      coaching.checkPair({ root: ALTO('E'), flavour: 'Aeolian' }),
    )
    expect((await createLocalStore().getAll())[0].attempts).toEqual(attemptsBefore)
    await expect(createLocalPreferenceStore().get()).resolves.toEqual({
      simpleMode: false,
      tapSounds: true,
      written: 'E♭',
    })
  })

  it('keeps simple mode’s six concert roots and labels them for the instrument, answer included (R9, AC11, AC14)', async () => {
    const user = userEvent.setup()
    await seedPreferences({ simpleMode: true })
    await renderPuzzle()
    const six = simpleRootOptions(new Date(), ANSWER)
    expect(rootLabels()).toEqual([...six])
    await toAlto(user)
    expect(rootLabels()).toEqual(six.map(ALTO))
    expect(rootLabels()).toContain(ALTO(ANSWER.root))
    await pick(user, 'B♭')
    expect(rootLabels()).toEqual(six.map((r) => writtenRoot(r, 'B♭')))
    expect(rootLabels()).toHaveLength(6)
  })

  it('reopens on alto, chips already in alto pitch, before any interaction (R2, AC2)', async () => {
    await seedPreferences({ written: 'E♭' })
    await renderPuzzle()
    expect(transposeBox()).toHaveValue('E♭')
    expect(rootLabels()).toEqual(ROOTS.map(ALTO))
  })

  it('stores the choice the moment it is made (R2)', async () => {
    const user = userEvent.setup()
    await renderPuzzle()
    await toAlto(user)
    await expect(createLocalPreferenceStore().get()).resolves.toMatchObject({
      written: 'E♭',
    })
  })

  it('relabels for the session and surfaces no error when storage throws on read and write (R3, AC4)', async () => {
    vi.spyOn(globalThis.localStorage, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    vi.spyOn(globalThis.localStorage, 'setItem').mockImplementation(() => {
      throw new Error('QuotaExceededError')
    })
    try {
      const user = userEvent.setup()
      await renderPuzzle()
      const before = rootLabels()
      await toAlto(user)
      expect(transposeBox()).toHaveValue('E♭')
      expect(rootLabels()).toEqual(before.map((r) => ALTO(r as Root)))
      expect(screen.queryAllByRole('alert')).toEqual([])
    } finally {
      vi.restoreAllMocks()
    }
  })

  it('renders the guess card identically on alto but for the root chip letters (R11, AC13)', async () => {
    const cardTextWithoutRootChips = () => {
      const clone = card().cloneNode(true) as HTMLElement
      clone.querySelector('[role="radiogroup"] [data-testid="chip-list"]')?.remove()
      return clone.textContent
    }
    const user = userEvent.setup()
    await renderPuzzle()
    const concert = cardTextWithoutRootChips()
    await toAlto(user)
    expect(cardTextWithoutRootChips()).toBe(concert)
    expect(
      screen.getByRole('radiogroup', { name: puzzle.rootGroup }),
    ).toBeInTheDocument()
    expect(within(card()).queryByRole('combobox')).toBeNull()
    expect(screen.getAllByRole('combobox', { name: header.transpose })).toHaveLength(1)
  })
})
