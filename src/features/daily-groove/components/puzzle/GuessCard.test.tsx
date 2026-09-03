import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, type Mock } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Attempt, DailyResult, Flavour, Groove, Root } from '../../types'
import { flavourOptions, flavourPool, simpleRootOptions } from '@/lib/theory/music'
import { ROOTS } from '@/lib/theory/roots'
import { FAMILIES, type Family } from '@/lib/theory/families'
import { scheduleLick } from '@/lib/theory/phrase'
import { simpleLickMode } from '@/lib/theory/simpleModes'
import { GROOVES } from '../../data/grooves.generated'
import {
  NOTES,
  PITCHES,
  type PitchSample,
  type ReferenceNote,
} from '../../data/notes.generated'
import { selectGrooveForDate } from '../../lib/puzzle/selectGroove'
import { selectFeedback } from '../../lib/presentation/feedback'
import { LADDER } from '../../lib/presentation/moves'
import { COLOUR_MOVES, TONIC_MOVES } from '../../lib/presentation/coachingMoves'
import { renderFeature } from '../../testing/renderFeature'
import type { FakeContext } from '../../testing/fakeAudioContext'
import {
  ANSWER,
  CHANGES_READ,
  chipAdornment,
  chipLabel,
  clearStored,
  control,
  flavourGroup,
  flavours,
  GROOVE,
  installPuzzleAudio,
  miss,
  NOTE_GLYPH,
  nudgeLine,
  otherWrongFlavour,
  renderPuzzle,
  rootGroup,
  seedDay,
  seedPreferences,
  settle,
  SOLVING,
  soundedNotes,
  storedDay,
  teardownPuzzleAudio,
  thirdWrongFlavour,
  wrongFlavour,
} from '../../testing/puzzleHarness'
import { GroovePuzzle } from '../GroovePuzzle'

const CARD_SOURCE = readFileSync(
  resolve(
    process.cwd(),
    'src/features/daily-groove/components/puzzle/GuessCard.tsx',
  ),
  'utf8',
)

const card = () => rootGroup().closest('div.rounded-card') as HTMLElement
const chipList = (group: HTMLElement) =>
  group.querySelector('[data-testid="chip-list"]') as HTMLElement
const hintBox = () => screen.getByRole('complementary', { name: 'Hint' })
const hintQuery = () => screen.queryByRole('complementary', { name: 'Hint' })
const cardStatus = () => within(card()).getByRole('status')
const cardStatusQuery = () => within(card()).queryByRole('status')
const modeSwitch = () => screen.getByRole('switch', { name: /simple mode/i })
const soundSwitch = () => screen.getByRole('switch', { name: /tap sounds/i })
const cardHeading = () =>
  screen.getByRole('heading', { name: 'What is it?' })
const precedes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
const MODE_NAME = /ionian|dorian|phrygian|lydian|mixolydian|aeolian|locrian/i
const LONGEST_FLAVOUR = [...new Set(GROOVES.map((g) => g.flavour))].sort(
  (a, b) => b.length - a.length,
)[0]

const noteSrc = (root: string) =>
  (NOTES.find((note) => note.root === root) as ReferenceNote).audioSrc

const pitchSrc = (midi: number) =>
  (PITCHES.find((pitch) => pitch.midi === midi) as PitchSample).audioSrc

const fetchedUrls = () =>
  (globalThis.fetch as unknown as Mock).mock.calls.map(([url]) => String(url))

const fetchedNotes = () =>
  fetchedUrls().filter((url) => url.startsWith('/notes/'))

const lickPhrase = (flavour: Flavour) =>
  scheduleLick({ flavour, root: GROOVE.root, bpm: GROOVE.bpm })

const lickFiles = (...modes: Flavour[]) => {
  const wanted: string[] = []
  for (const mode of modes) {
    for (const note of lickPhrase(mode)) {
      const src = pitchSrc(note.midi)
      if (!wanted.includes(src)) wanted.push(src)
    }
  }
  return wanted
}

const chipsIn = (group: HTMLElement) => within(group).getAllByRole('button')
const dimmedIn = (group: HTMLElement) =>
  chipsIn(group)
    .filter((chip) => chip.getAttribute('aria-disabled') === 'true')
    .map(chipLabel)
const liveIn = (group: HTMLElement) =>
  chipsIn(group)
    .filter((chip) => chip.getAttribute('aria-disabled') !== 'true')
    .map(chipLabel)
const pressedIn = (group: HTMLElement) =>
  chipsIn(group)
    .filter((chip) => chip.getAttribute('aria-pressed') === 'true')
    .map(chipLabel)
const rootChip = (name: string) =>
  within(rootGroup()).getByRole('button', { name })
const modeChip = (name: string) =>
  within(flavourGroup()).getByRole('button', { name })

const GIVE_UP = 'Give up and show the answer'
const CONFIRM = 'Yes — end the day and show the answer'
const giveUp = () => screen.queryByRole('button', { name: GIVE_UP })
const confirm = () => screen.queryByRole('button', { name: CONFIRM })
const ended = () => screen.queryByRole('img', { name: CHANGES_READ })

const flavourHit = (root: Root, flavour: Flavour): Attempt => ({
  root,
  flavour,
  correct: false,
  rootMatched: false,
  flavourMatched: true,
})

const verdictOf = (attempts: Attempt[], solved = false) =>
  selectFeedback(attempts, solved).message

const OFF_ROW_FLAVOUR = 'Major'

const threeMisses = (): Attempt[] => [
  miss('G', wrongFlavour(), false),
  miss('D', otherWrongFlavour(), false),
  miss('E', thirdWrongFlavour(), false),
]

const twoMisses = (): Attempt[] => [
  miss('G', wrongFlavour(), false),
  miss('D', otherWrongFlavour(), false),
]

const verdictAndNudge = (): Attempt[] => [
  miss('G', wrongFlavour(), false),
  flavourHit('D', 'Aeolian'),
]

async function openDay(over: Partial<DailyResult> = {}) {
  await seedDay(storedDay(over))
  return renderPuzzle()
}

let fake: FakeContext

describe('GuessCard', () => {
  beforeEach(() => {
    clearStored()
    ;({ fake } = installPuzzleAudio())
  })

  afterEach(() => {
    teardownPuzzleAudio()
  })

  it('scores a guess made on the card against the shell’s own session (F20 E2 R4b, AC4a)', async () => {
    const user = userEvent.setup()
    await openDay()

    await user.click(rootChip('G'))
    await user.click(modeChip(wrongFlavour()))
    await user.click(control())

    expect(cardStatus()).toHaveTextContent(
      verdictOf([miss('G', wrongFlavour(), false)]),
    )
    expect(dimmedIn(rootGroup())).toEqual(['G'])
  })

  it('shows the shell’s solved panel when the card solves the day (F20 E2 R4b, AC4a)', async () => {
    const user = userEvent.setup()
    await openDay()

    await user.click(rootChip('C'))
    await user.click(modeChip('Aeolian'))
    await user.click(control())

    expect(control()).toHaveAccessibleName('Solved')
    expect(
      screen.getByRole('img', { name: CHANGES_READ }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('heading', { name: 'C Aeolian' }),
    ).toBeInTheDocument()
  })

  it('opens on the rung the stored day left the player at (F20 E2 R10, R10a)', async () => {
    await openDay({ attempts: [miss('G', wrongFlavour(), false)] })

    expect(rootChip('G')).toHaveAttribute('aria-disabled', 'true')
    expect(hintBox()).toHaveTextContent(LADDER[1].message)
  })

  it('records nothing and hydrates nothing on a shared groove (F20 E2 R4b, AC4a)', async () => {
    const user = userEvent.setup()
    await seedDay(storedDay({ attempts: [miss('G', wrongFlavour(), false)] }))

    const shared = await renderPuzzle(
      <GroovePuzzle groove={GROOVE} mode="shared" />,
    )
    expect(rootChip('G')).not.toHaveAttribute('aria-disabled')

    await user.click(rootChip('G'))
    await user.click(modeChip(wrongFlavour()))
    await user.click(control())
    shared.unmount()

    await renderPuzzle(<GroovePuzzle groove={GROOVE} mode="shared" />)
    expect(hintBox()).toHaveTextContent(LADDER[0].message)
  })

  it('takes exactly the two callbacks it cannot own (F20 E2 R5, AC5)', () => {
    const block = CARD_SOURCE.match(/type GuessCardProps = \{([\s\S]*?)\n\}/)
    expect(block).not.toBeNull()
    const members = [
      ...(block as RegExpMatchArray)[1].matchAll(/^\s*(\w+)/gm),
    ].map((m) => m[1])

    expect(members).toEqual(['onHearRoot', 'onHearMode'])
    expect(CARD_SOURCE).not.toContain('answerRoot')
    expect((block as RegExpMatchArray)[1]).not.toMatch(/answer/i)
  })

  it('reads its state from the session and its derivation from the door (F20 E2 R4, R4a, AC4)', () => {
    expect(CARD_SOURCE).toContain("from '../../lib/presentation'")
    expect(CARD_SOURCE).toContain("from '../../state/PuzzleSessionContext'")
    expect(CARD_SOURCE).toContain('usePuzzleSessionContext()')
    expect(CARD_SOURCE).toContain('guessCardView(')
  })

  it('holds the one mapping from the domain state to the design system’s (F20 E2 R3b, AC3)', () => {
    expect(CARD_SOURCE).not.toContain('optionStatesFor')
    expect(CARD_SOURCE.match(/ChipOptionState/g) ?? []).toHaveLength(2)
    expect(CARD_SOURCE).toMatch(/state === 'out'/)
  })

  it('labels the second chip row "Mode", not "Flavour" (R1, AC1)', async () => {
    await openDay()

    expect(screen.getByRole('radiogroup', { name: 'Mode' })).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Flavour' })).toBeNull()
  })

  it('offers twelve root chips and exactly four flavour chips (AC1)', async () => {
    await openDay()

    expect(chipsIn(rootGroup())).toHaveLength(12)
    expect(chipsIn(flavourGroup())).toHaveLength(4)
  })

  it('renders the roots and flavours it is given, in order (R1, R2, R3)', async () => {
    await openDay()

    expect(chipsIn(rootGroup()).map(chipLabel)).toEqual(ROOTS)
    expect(chipsIn(flavourGroup()).map(chipLabel)).toEqual(flavours())
  })

  it('reports a chip choice to the matching handler (R5)', async () => {
    const user = userEvent.setup()
    await openDay()

    await user.click(rootChip('G'))
    expect(rootChip('G')).toHaveAttribute('aria-pressed', 'true')

    await user.click(modeChip(wrongFlavour()))
    expect(modeChip(wrongFlavour())).toHaveAttribute('aria-pressed', 'true')
  })

  it('marks only the current selection in each group (R5, AC5)', async () => {
    const user = userEvent.setup()
    await openDay()

    await user.click(rootChip('G'))
    await user.click(modeChip(wrongFlavour()))

    expect(pressedIn(rootGroup())).toEqual(['G'])
    expect(pressedIn(flavourGroup())).toEqual([wrongFlavour()])
  })

  it('prompts and stays disabled until both halves are chosen (R7, AC6)', async () => {
    await openDay()

    expect(
      screen.getByRole('button', { name: 'Pick a root and a mode' }),
    ).toBeDisabled()
  })

  it('names the chosen pair once both are selected (R8, AC6)', async () => {
    const user = userEvent.setup()
    await openDay()

    await user.click(rootChip('G'))
    await user.click(modeChip(wrongFlavour()))

    expect(
      screen.getByRole('button', { name: `Check G ${wrongFlavour()}` }),
    ).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Pick a root and a mode' }),
    ).not.toBeInTheDocument()
  })

  it('keeps prompting while only one half is chosen (R7)', async () => {
    const user = userEvent.setup()
    await openDay()

    await user.click(rootChip('G'))

    expect(screen.getByRole('button', { name: 'Pick a mode' })).toBeDisabled()
  })

  it('scores the guess when the enabled control is pressed (R7)', async () => {
    const user = userEvent.setup()
    await openDay()

    await user.click(rootChip('G'))
    await user.click(modeChip(wrongFlavour()))
    await user.click(screen.getByRole('button', { name: `Check G ${wrongFlavour()}` }))

    expect(cardStatus()).toHaveTextContent(
      verdictOf([miss('G', wrongFlavour(), false)]),
    )
    expect(cardStatus()).toHaveTextContent(LADDER[1].message)
  })

  it('renders no count of the player’s guesses (F19 E1 R1, R2, AC1)', async () => {
    await openDay()

    expect(document.querySelectorAll('[data-dot-state]')).toHaveLength(0)
    expect(within(card()).queryByRole('img')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Pick a root and a mode' })
        .previousElementSibling,
    ).toBe(flavourGroup())
  })

  it('shows the feedback it is given in a live region (R3, R4, AC4, AC14)', async () => {
    await openDay()

    const region = cardStatus()
    expect(region).toContainElement(screen.getByText(LADDER[0].message))
    expect(region).toHaveAttribute('aria-live', 'polite')
  })

  it('shows the coaching under the verdict in the hint box (R12, AC11)', async () => {
    const attempts = [miss('C', wrongFlavour(), true)]
    await openDay({ attempts })

    const box = hintBox()
    const verdict = screen.getByText(verdictOf(attempts))
    const move = screen.getByText(COLOUR_MOVES[0].message)

    expect(box).toContainElement(verdict)
    expect(box).toContainElement(move)
    expect(precedes(verdict, move)).toBe(true)
    expect(move).toHaveAttribute('data-tone', 'neutral')
  })

  it('carries the coaching alone when the verdict is suppressed (R12a, AC16)', async () => {
    const attempts = twoMisses()
    await openDay({ attempts })

    expect(hintBox()).toHaveTextContent(LADDER[2].message)
    expect(screen.queryByText(verdictOf(attempts))).toBeNull()
  })

  it('shows targeted feedback after a wrong guess instead of a bare verdict (R3, AC5)', async () => {
    const attempts = [miss('C', wrongFlavour(), true)]
    await openDay({ attempts })

    expect(cardStatus()).toHaveTextContent(verdictOf(attempts))
    expect(screen.queryByText(/^not quite\.$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^correct\.$/i)).not.toBeInTheDocument()
  })

  it('drops the hint box, feedback and all, once the day is solved (R9, AC13)', async () => {
    await openDay({ attempts: [SOLVING], solved: true })

    expect(hintQuery()).not.toBeInTheDocument()
    expect(screen.queryByText(verdictOf([SOLVING], true))).not.toBeInTheDocument()
    expect(screen.queryByText(LADDER[0].message)).not.toBeInTheDocument()
    expect(cardStatusQuery()).not.toBeInTheDocument()
    expect(nudgeLine()).not.toBeInTheDocument()
  })

  it.each([
    ['solved', () => ({ attempts: [...twoMisses(), SOLVING], solved: true })],
    ['revealed', () => ({ attempts: threeMisses(), revealed: true })],
  ])(
    'renders no hint box at all on a %s day, however much it could say',
    async (_name, over) => {
      await openDay(over())

      expect(hintQuery()).not.toBeInTheDocument()
      expect(screen.queryByText('Hint')).not.toBeInTheDocument()
      expect(nudgeLine()).not.toBeInTheDocument()
      expect(cardStatusQuery()).not.toBeInTheDocument()
      expect(screen.queryByText(LADDER[2].message)).toBeNull()
    },
  )

  it('keeps the hint box on a playable day with misses behind it (R8, AC17)', async () => {
    const attempts = verdictAndNudge()
    await openDay({ attempts })

    expect(hintBox()).toHaveTextContent(verdictOf(attempts))
    expect(nudgeLine()).toBeInTheDocument()
  })

  it('shows no nudge sentence until it is asked for (R5, AC8)', async () => {
    await openDay()

    expect(nudgeLine()).not.toBeInTheDocument()
    expect(hintBox()).toContainElement(screen.getByText(LADDER[0].message))
  })

  it('names the count the app ruled out, below the feedback inside one box (R17, AC17)', async () => {
    const attempts = verdictAndNudge()
    await openDay({ attempts })

    const box = hintBox()
    expect(box).toHaveTextContent(/2 roots ruled out/)
    expect(box).toHaveTextContent(/narrowing/i)
    for (const root of ROOTS) {
      expect(box.textContent ?? '', root).not.toMatch(
        new RegExp(`(^|[^A-Za-z♭♯])${root}([^A-Za-z♭♯]|$)`),
      )
    }
    const status = cardStatus()
    expect(status).toHaveTextContent(verdictOf(attempts))
    expect(box).toContainElement(status)
    expect(precedes(status, nudgeLine() as HTMLElement)).toBe(true)
  })

  it('renders no nudge sentence when the app has eliminated nothing (R19, AC18)', async () => {
    await openDay()

    expect(nudgeLine()).not.toBeInTheDocument()
    expect(hintBox()).toHaveTextContent(LADDER[0].message)
  })

  it('renders the box with the count it was handed (R17, AC17)', async () => {
    await openDay({ attempts: threeMisses() })

    expect(hintBox()).toHaveTextContent(/4 roots ruled out/)
  })

  it('labels the one box "Hint", never "A nudge" (R6, AC9)', async () => {
    await openDay({ attempts: twoMisses() })

    expect(screen.getByText('Hint')).toBeInTheDocument()
    expect(screen.queryByText(/a nudge/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('complementary', { name: 'A nudge' }),
    ).not.toBeInTheDocument()
  })

  it('keeps the feedback the card’s only live region (R5, R10, AC14)', async () => {
    const attempts = verdictAndNudge()
    await openDay({ attempts })

    expect(hintBox()).not.toHaveAttribute('aria-live')
    expect(card().querySelectorAll('[aria-live]')).toHaveLength(1)
    const regions = within(card()).getAllByRole('status')
    expect(regions).toHaveLength(1)
    expect(regions[0]).toHaveTextContent(verdictOf(attempts))
    expect(regions[0]).toHaveTextContent(TONIC_MOVES[0].message)
    expect(regions[0]).toHaveTextContent(/2 roots ruled out/)
  })

  it('leaves every root chip unpressed and enabled when the box appears (AC10, AC11)', async () => {
    await openDay()

    expect(hintBox()).toBeInTheDocument()
    const chips = chipsIn(rootGroup())
    expect(chips).toHaveLength(12)
    expect(pressedIn(rootGroup())).toEqual([])
    for (const chip of chips) expect(chip).toBeEnabled()
    expect(dimmedIn(rootGroup())).toEqual([])
  })

  it('offers every root as an ordinary, clickable choice while the box shows (R6, AC10)', async () => {
    const user = userEvent.setup()
    await openDay()

    expect(hintBox()).toBeInTheDocument()
    await user.click(rootChip('G'))

    expect(pressedIn(rootGroup())).toEqual(['G'])
    expect(dimmedIn(rootGroup())).toEqual([])
  })

  it('keeps the surviving chip pressed and disables the control after a wrong check (AC9)', async () => {
    const user = userEvent.setup()
    await openDay()

    await user.click(rootChip('C'))
    await user.click(modeChip(wrongFlavour()))
    await user.click(control())

    expect(rootChip('C')).toHaveAttribute('aria-pressed', 'true')
    expect(modeChip(wrongFlavour())).toHaveAttribute('aria-pressed', 'false')
    expect(modeChip(wrongFlavour())).toHaveAttribute('aria-disabled', 'true')
    expect(control()).toHaveAccessibleName('Pick a mode')
    expect(control()).toBeDisabled()

    await user.click(modeChip(otherWrongFlavour()))

    expect(
      screen.getByRole('button', { name: `Check C ${otherWrongFlavour()}` }),
    ).toBeEnabled()
  })

  it('stops accepting chip input once the day is solved (AC10)', async () => {
    const user = userEvent.setup()
    await openDay({ attempts: [SOLVING], solved: true })

    await user.click(rootChip('D'))
    expect(pressedIn(rootGroup())).toEqual(['C'])

    await user.click(modeChip(wrongFlavour()))
    expect(pressedIn(flavourGroup())).toEqual(['Aeolian'])
  })

  it('gives the control its solved treatment once the day is solved (R12)', async () => {
    const user = userEvent.setup()
    const ready = await openDay()
    await user.click(rootChip('G'))
    await user.click(modeChip(wrongFlavour()))
    const readyClass = control().className
    ready.unmount()

    await openDay({ attempts: [SOLVING], solved: true })

    expect(control()).toHaveAccessibleName('Solved')
    expect(control()).toBeDisabled()
    expect(control().className).not.toBe(readyClass)
  })

  const sizeOf = (el: HTMLElement) =>
    (el.className.match(/py-\[\d+px\]|text-\[\d+px\]/g) ?? []).sort()

  it('renders the check control at the play control’s size (R15, R18, AC13)', async () => {
    const user = userEvent.setup()
    await openDay()
    await user.click(rootChip('G'))
    await user.click(modeChip(wrongFlavour()))

    const check = control()
    const play = screen.getByRole('button', { name: 'Play the loop' })

    expect(sizeOf(check)).toEqual(sizeOf(play))
    expect(sizeOf(check)).toEqual(['py-[22px]', 'text-[17px]'])
  })

  it('leaves the give-up control at the default size (R18)', async () => {
    await openDay({ attempts: threeMisses() })

    expect(sizeOf(giveUp() as HTMLElement)).toEqual([
      'py-[15px]',
      'text-[15px]',
    ])
  })

  const LONGEST_CHECK_LABELS = (() => {
    const modes = [...new Set(GROOVES.map((groove) => groove.flavour))]
    const labels = ROOTS.flatMap((root) =>
      modes.map((flavour) => `Check ${root} ${flavour}`),
    )
    const longest = Math.max(...labels.map((label) => label.length))
    return labels.filter((label) => label.length === longest)
  })()

  const LONGEST_CHECK_LABEL = 'Check E♭ Phrygian dominant'

  const LONG_GROOVE: Groove = {
    ...GROOVE,
    root: 'E♭',
    flavour: LONGEST_FLAVOUR,
    scale: `E♭ ${LONGEST_FLAVOUR}`,
  }

  it('has a longest possible label of 26 characters (R16, AC14)', () => {
    for (const label of LONGEST_CHECK_LABELS) {
      expect(label, label).toHaveLength(26)
    }
    expect(LONGEST_CHECK_LABELS).toContain(LONGEST_CHECK_LABEL)
  })

  it('renders the longest label it can show in full, uncut (R16, AC14)', async () => {
    const user = userEvent.setup()
    await seedDay(
      storedDay({ answer: { root: 'E♭', flavour: LONGEST_FLAVOUR } }),
    )
    await renderPuzzle(<GroovePuzzle groove={LONG_GROOVE} />)

    await user.click(rootChip('E♭'))
    await user.click(modeChip(LONGEST_FLAVOUR))

    const check = screen.getByRole('button', { name: LONGEST_CHECK_LABEL })

    expect(check.textContent).toBe(LONGEST_CHECK_LABEL)
    expect(check.childNodes).toHaveLength(1)

    for (const cut of [
      /\btruncate\b/,
      /\btext-ellipsis\b/,
      /\boverflow-hidden\b/,
      /\bwhitespace-nowrap\b/,
    ]) {
      expect(check.className).not.toMatch(cut)
    }
  })

  it('keeps the waiting, live and solved states apart at the larger size (R17, AC15)', async () => {
    const user = userEvent.setup()
    const states: { name: string; token: string; className: string }[] = []

    const waiting = await openDay()
    states.push({
      name: 'Pick a root and a mode',
      token: 'bg-surface-inset',
      className: control().className,
    })
    await user.click(rootChip('G'))
    await user.click(modeChip(wrongFlavour()))
    states.push({
      name: `Check G ${wrongFlavour()}`,
      token: 'bg-accent',
      className: control().className,
    })
    waiting.unmount()

    await openDay({ attempts: [SOLVING], solved: true })
    states.push({
      name: 'Solved',
      token: 'bg-accent-soft',
      className: control().className,
    })

    expect(new Set(states.map((state) => state.className)).size).toBe(3)
    for (const state of states) {
      expect(state.className, state.name).toContain(state.token)
      expect(state.className, state.name).toContain('py-[22px]')
    }
  })

  it('lays the twelve roots out on 4 columns, rising to 6 (R2a, R4, AC4)', async () => {
    await openDay()
    const list = chipList(rootGroup())

    expect(list.className).toMatch(/\bgrid\b/)
    expect(list.className).toContain('grid-cols-4')
    expect(list.className).toContain('md:grid-cols-6')
  })

  it('lays the four flavours out on 2 columns, rising to 4 (R2a, R4, AC4)', async () => {
    await openDay()
    const list = chipList(flavourGroup())

    expect(list.className).toMatch(/\bgrid\b/)
    expect(list.className).toContain('grid-cols-2')
    expect(list.className).toContain('md:grid-cols-4')
  })

  it('asks for no chip width on either row (R6, AC7)', async () => {
    await openDay()

    for (const chip of within(card()).getAllByRole('button')) {
      expect(chip.className).not.toMatch(/\bw-\[/)
    }
  })

  it('lays both rows out through the same component (R4, AC4)', async () => {
    await openDay()
    const root = chipList(rootGroup())
    const flavour = chipList(flavourGroup())

    for (const list of [root, flavour]) {
      expect(list.className).toMatch(/\bgrid\b/)
      expect(list.className).toMatch(/\bgrid-cols-\d+\b/)
      expect(list.className).toMatch(/\bmd:grid-cols-\d+\b/)
      expect(list.className).not.toContain('flex-wrap')
    }

    const shape = (list: HTMLElement) =>
      list.className.replace(/grid-cols-\d+/g, 'grid-cols-N')
    expect(shape(root)).toBe(shape(flavour))
  })

  it('sounds a chip it declines to select (R4a, AC5a)', async () => {
    const user = userEvent.setup()
    await openDay({ attempts: [miss('G', wrongFlavour(), false)] })

    await user.click(rootChip('G'))

    await soundedNotes(1)
    expect(fetchedNotes()).toEqual([noteSrc('G')])
    expect(pressedIn(rootGroup())).toEqual([])
  })

  it('dims the roots it is told are ruled out, and leaves the row alone (R4, R5, R6)', async () => {
    const user = userEvent.setup()
    await openDay({ attempts: [miss('G', wrongFlavour(), false)] })

    const chips = chipsIn(rootGroup())
    expect(chips.map(chipLabel)).toEqual(ROOTS)

    const dimmed = chips.filter(
      (chip) => chip.getAttribute('aria-disabled') === 'true',
    )
    expect(dimmed.map(chipLabel)).toEqual(['G'])
    for (const chip of dimmed) expect(chip, chipLabel(chip)).not.toBeDisabled()

    const live = rootChip('C')
    for (const chip of dimmed) {
      expect(chip.className, chipLabel(chip)).not.toBe(live.className)
    }

    const before = hintBox().textContent
    await user.click(rootChip('G'))
    expect(pressedIn(rootGroup())).toEqual([])
    expect(hintBox().textContent).toBe(before)
  })

  it('dims a ruled-out mode in the treatment a ruled-out root wears (R4, R5, AC5)', async () => {
    const user = userEvent.setup()
    await openDay({ attempts: [miss('G', wrongFlavour(), false)] })

    expect(chipsIn(flavourGroup()).map(chipLabel)).toEqual(flavours())

    const chip = modeChip(wrongFlavour())
    expect(chip).toHaveAttribute('aria-disabled', 'true')
    expect(chip).not.toBeDisabled()
    expect(chip.className).toBe(rootChip('G').className)
    expect(chip.className).not.toBe(modeChip('Aeolian').className)

    const out = wrongFlavour() as Flavour
    await user.click(chip)
    await soundedNotes(lickPhrase(out).length)
    expect(fetchedNotes()).toEqual(lickFiles(out))
    expect(pressedIn(flavourGroup())).toEqual([])
  })

  it('keeps a simple-mode row whole while one of its two options is out (R4, R6)', async () => {
    await seedPreferences({ simpleMode: true })
    await openDay({ attempts: [miss('G', 'Major', false)] })

    expect(chipsIn(flavourGroup()).map(chipLabel)).toEqual(FAMILIES)
    expect(dimmedIn(flavourGroup())).toEqual(['Major'])
  })

  it.each([
    [
      'solved',
      () => ({
        attempts: [miss('G', wrongFlavour(), false), SOLVING],
        solved: true,
      }),
    ],
    [
      'revealed',
      () => ({
        attempts: [miss('G', wrongFlavour(), false)],
        revealed: true,
      }),
    ],
  ])(
    'silences a ruled-out chip once the day is %s (R4b, AC5b)',
    async (_name, over) => {
      const user = userEvent.setup()
      await openDay(over())

      const chip = rootChip('G')
      expect(chip).toBeDisabled()

      await user.click(chip)
      await settle()
      expect(fetchedNotes()).toEqual([])
      expect(fake.sources).toHaveLength(0)
      expect(pressedIn(rootGroup())).not.toContain('G')

      for (const group of [rootGroup(), flavourGroup()]) {
        for (const other of chipsIn(group)) {
          expect(other, chipLabel(other)).toBeDisabled()
        }
      }
    },
  )

  it('keeps the ruled-out chips distinguishable once the day has ended (R20, AC19)', async () => {
    await openDay({
      attempts: [miss('G', wrongFlavour(), false)],
      revealed: true,
    })

    const chips = chipsIn(rootGroup())
    expect(chips).toHaveLength(12)
    expect(new Set(chips.map((chip) => chip.className)).size).toBe(2)

    const isOut = (chip: Element) => chip.getAttribute('aria-disabled') === 'true'
    const ruled = chips.filter(isOut)
    const rest = chips.filter((chip) => !isOut(chip))
    expect(ruled.map(chipLabel)).toEqual(['G'])
    expect(new Set(ruled.map((chip) => chip.className)).size).toBe(1)
    expect(new Set(rest.map((chip) => chip.className)).size).toBe(1)
    expect(ruled[0].className).not.toBe(rest[0].className)

    for (const chip of chips) expect(chip, chipLabel(chip)).toBeDisabled()
  })

  it('offers no way to give up until it is asked for (R6, AC6)', async () => {
    await openDay()

    expect(giveUp()).not.toBeInTheDocument()
    expect(confirm()).not.toBeInTheDocument()
  })

  it('offers to give up once three misses are behind the player (R6, AC6)', async () => {
    await openDay({ attempts: threeMisses() })

    expect(giveUp()).toBeInTheDocument()
    expect(giveUp()).toBeEnabled()
  })

  it('asks for confirmation on the first press rather than ending the day (R6a, AC8)', async () => {
    const user = userEvent.setup()
    await openDay({ attempts: threeMisses() })

    await user.click(giveUp() as HTMLElement)

    expect(ended()).toBeNull()
    expect(giveUp()).not.toBeInTheDocument()
    expect(confirm()).toBeInTheDocument()

    for (const chip of chipsIn(rootGroup())) expect(chip).toBeEnabled()
  })

  it('ends the day on the second press, exactly once (R7, AC8a)', async () => {
    const user = userEvent.setup()
    await openDay({ attempts: threeMisses() })

    await user.click(giveUp() as HTMLElement)
    await user.click(confirm() as HTMLElement)

    expect(screen.getByRole('img', { name: CHANGES_READ })).toBeInTheDocument()
    expect(giveUp()).toBeNull()
    expect(confirm()).toBeNull()
  })

  it('disarms when a root chip is selected instead (R6b, AC8c)', async () => {
    const user = userEvent.setup()
    await openDay({ attempts: threeMisses() })

    await user.click(giveUp() as HTMLElement)
    expect(confirm()).toBeInTheDocument()

    await user.click(rootChip('C'))

    expect(pressedIn(rootGroup())).toEqual(['C'])
    expect(ended()).toBeNull()
    expect(confirm()).not.toBeInTheDocument()
    expect(giveUp()).toBeInTheDocument()
  })

  it('disarms when a flavour chip is selected instead (R6b, AC8c)', async () => {
    const user = userEvent.setup()
    await openDay({ attempts: threeMisses() })

    await user.click(giveUp() as HTMLElement)
    await user.click(modeChip('Aeolian'))

    expect(pressedIn(flavourGroup())).toEqual(['Aeolian'])
    expect(ended()).toBeNull()
    expect(giveUp()).toBeInTheDocument()
  })

  it('disarms when a guess is checked instead, and still scores it (R6b, AC8b)', async () => {
    const user = userEvent.setup()
    const attempts = threeMisses()
    await openDay({ attempts })

    const openRoot = liveIn(rootGroup()).find((root) => root !== 'C') as string

    await user.click(giveUp() as HTMLElement)
    expect(confirm()).toBeInTheDocument()

    await user.click(rootChip(openRoot))
    await user.click(modeChip('Aeolian'))
    await user.click(control())

    expect(cardStatus()).toHaveTextContent(
      verdictOf([...attempts, flavourHit(openRoot as Root, 'Aeolian')]),
    )
    expect(ended()).toBeNull()
    expect(confirm()).not.toBeInTheDocument()
    expect(giveUp()).toBeInTheDocument()
  })

  it('goes inert once the day is revealed (R7, AC8a)', async () => {
    const user = userEvent.setup()
    await openDay({ attempts: threeMisses(), revealed: true })

    for (const chip of chipsIn(rootGroup())) expect(chip).toBeDisabled()
    for (const chip of chipsIn(flavourGroup())) expect(chip).toBeDisabled()

    expect(control()).toBeDisabled()

    await user.click(rootChip('C'))
    await user.click(modeChip('Aeolian'))
    await user.click(control())

    expect(pressedIn(rootGroup())).toEqual([])
    expect(pressedIn(flavourGroup())).toEqual([])
    expect(control()).toHaveAccessibleName('Pick a root and a mode')

    expect(giveUp()).not.toBeInTheDocument()
    expect(confirm()).not.toBeInTheDocument()
  })

  it('leaves the check control disabled on a revealed day even if a check would be legal (R7, AC8a)', async () => {
    const user = userEvent.setup()
    await openDay({ attempts: threeMisses() })

    await user.click(rootChip('C'))
    await user.click(modeChip('Aeolian'))
    expect(control()).toBeEnabled()

    await user.click(giveUp() as HTMLElement)
    await user.click(confirm() as HTMLElement)

    expect(control()).toHaveAccessibleName('Check C Aeolian')
    expect(control()).toBeDisabled()
  })

  it('carries a simple-mode switch, under the heading and above both rows (R1, AC1)', async () => {
    await openDay()

    const toggle = modeSwitch()
    expect(precedes(cardHeading(), toggle)).toBe(true)
    expect(precedes(toggle, rootGroup())).toBe(true)
    expect(precedes(toggle, flavourGroup())).toBe(true)
  })

  it('reports the mode the player asked for, not the one they left (R1, AC1)', async () => {
    const user = userEvent.setup()
    await openDay()

    expect(chipsIn(rootGroup())).toHaveLength(12)
    await user.click(modeSwitch())

    await waitFor(() => expect(chipsIn(rootGroup())).toHaveLength(6))
    expect(modeSwitch()).toBeChecked()
  })

  it('asks to leave simple mode when it is already on (R1, AC1)', async () => {
    const user = userEvent.setup()
    await seedPreferences({ simpleMode: true })
    await openDay()

    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
    expect(chipsIn(rootGroup())).toHaveLength(6)

    await user.click(modeSwitch())

    await waitFor(() => expect(chipsIn(rootGroup())).toHaveLength(12))
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'false')
  })

  it('keeps the switch live on a playable day with misses behind it (F11 E4 R3, AC3)', async () => {
    const user = userEvent.setup()
    await openDay({ attempts: [miss('G', wrongFlavour(), false)] })

    expect(modeSwitch()).toBeEnabled()
    await user.click(modeSwitch())

    await waitFor(() => expect(chipsIn(rootGroup())).toHaveLength(6))
    expect(modeSwitch()).toBeChecked()
  })

  it('settles the switch on a day that is already over (F11 E4 R1, AC1)', async () => {
    const user = userEvent.setup()
    await openDay({ attempts: [SOLVING], solved: true })

    expect(chipsIn(rootGroup())[0]).toBeDisabled()
    expect(modeSwitch()).toBeDisabled()
    await user.click(modeSwitch())
    expect(chipsIn(rootGroup())).toHaveLength(12)
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'false')
  })

  it('settles the switch on a revealed day too (F11 E4 R2, AC2)', async () => {
    const user = userEvent.setup()
    await openDay({ attempts: threeMisses(), revealed: true })

    expect(modeSwitch()).toBeDisabled()
    await user.click(modeSwitch())
    expect(chipsIn(rootGroup())).toHaveLength(12)
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'false')
  })

  it('keeps a settled switch showing which mode the day was played in (F11 E4 R4, R5, AC4, AC5)', async () => {
    await seedPreferences({ simpleMode: true })
    await openDay({ attempts: [SOLVING], solved: true })

    expect(modeSwitch()).toBeInTheDocument()
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
  })

  it('leaves the finished card untouched when its settled switch is clicked (F11 E4 R7, R7a)', async () => {
    const user = userEvent.setup()
    await openDay({ attempts: [SOLVING], solved: true })

    const before = {
      roots: chipsIn(rootGroup()).map(chipLabel),
      flavours: chipsIn(flavourGroup()).map(chipLabel),
    }

    await user.click(modeSwitch())

    expect(chipsIn(rootGroup()).map(chipLabel)).toEqual(before.roots)
    expect(chipsIn(flavourGroup()).map(chipLabel)).toEqual(before.flavours)
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'false')
  })

  it('disarms an armed give-up when the mode is switched instead (R6b)', async () => {
    const user = userEvent.setup()
    await openDay({ attempts: threeMisses() })

    await user.click(screen.getByRole('button', { name: GIVE_UP }))
    expect(confirm()).toBeInTheDocument()

    await user.click(modeSwitch())

    expect(screen.getByRole('button', { name: GIVE_UP })).toBeInTheDocument()
    expect(ended()).toBeNull()
  })

  for (const simple of [false, true]) {
    it(`keeps both rows labelled and single-select with simple=${simple} (R11, AC11)`, async () => {
      const user = userEvent.setup()
      if (simple) await seedPreferences({ simpleMode: true })
      await openDay()

      const root = chipsIn(rootGroup()).map(chipLabel)[3]
      const mode = chipsIn(flavourGroup()).map(chipLabel)[1]
      await user.click(rootChip(root))
      await user.click(modeChip(mode))

      expect(pressedIn(rootGroup())).toEqual([root])
      expect(pressedIn(flavourGroup())).toEqual([mode])
    })

    it(`keeps the switch and both rows keyboard-reachable with simple=${simple} (R11, AC11)`, async () => {
      const user = userEvent.setup()
      if (simple) await seedPreferences({ simpleMode: true })
      await openDay()

      const visited: Element[] = []
      for (let i = 0; i < 30; i += 1) {
        await user.tab()
        if (document.activeElement) visited.push(document.activeElement)
      }

      const toggle = modeSwitch()
      const sounds = soundSwitch()
      const firstRoot = chipsIn(rootGroup())[0]
      const firstFlavour = chipsIn(flavourGroup())[0]

      expect(visited).toContain(toggle)
      expect(visited).toContain(sounds)
      expect(visited).toContain(firstRoot)
      expect(visited).toContain(firstFlavour)
      expect(visited.indexOf(toggle)).toBeLessThan(visited.indexOf(sounds))
      expect(visited.indexOf(sounds)).toBeLessThan(visited.indexOf(firstRoot))
      expect(visited.indexOf(firstRoot)).toBeLessThan(
        visited.indexOf(firstFlavour),
      )
    })
  }

  it('offers exactly the two options it is handed in simple mode (R4, AC3)', async () => {
    await seedPreferences({ simpleMode: true })
    await openDay()

    expect(chipsIn(flavourGroup()).map(chipLabel)).toEqual(['Major', 'Minor'])
  })

  it('keeps the second row labelled "Mode" in either mode (R4, AC3)', async () => {
    await seedPreferences({ simpleMode: true })
    await openDay()

    expect(screen.getByRole('radiogroup', { name: 'Mode' })).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Family' })).toBeNull()
  })

  it('names no mode anywhere on the card in simple mode (R4, AC3)', async () => {
    const user = userEvent.setup()
    await seedPreferences({ simpleMode: true })
    await openDay()

    await user.click(chipsIn(rootGroup())[2])
    await user.click(modeChip('Minor'))

    expect(rootGroup().textContent).not.toMatch(MODE_NAME)
    expect(flavourGroup().textContent).not.toMatch(MODE_NAME)
    expect(card().textContent).not.toMatch(MODE_NAME)
  })

  it('never shows the chord or the progression while unsolved (Epic 4 guard)', async () => {
    const user = userEvent.setup()
    await openDay()

    await user.click(rootChip('C'))
    await user.click(modeChip(wrongFlavour()))

    expect(card().textContent).not.toContain('Cm7')
    expect(card().textContent).not.toContain('Cm–Fm–G7')
  })

  const lickLength = (flavour: Flavour) =>
    scheduleLick({ flavour, root: GROOVE.root, bpm: GROOVE.bpm }).length

  it('reports the root and asks for its note on the same tap (R1, R2, AC1)', async () => {
    const user = userEvent.setup()
    await openDay()

    await user.click(rootChip('E♭'))

    expect(pressedIn(rootGroup())).toEqual(['E♭'])
    const first = await soundedNotes(1)
    expect(first[0].start).toHaveBeenCalledTimes(1)
    expect(fetchedNotes()).toEqual([noteSrc('E♭')])

    await user.click(rootChip('A'))

    expect(pressedIn(rootGroup())).toEqual(['A'])
    await soundedNotes(2)
    expect(fetchedNotes()).toEqual([noteSrc('E♭'), noteSrc('A')])
  })

  it('asks again when the root already selected is tapped again (R1, AC2)', async () => {
    const user = userEvent.setup()
    await openDay()

    await user.click(rootChip('E♭'))
    await soundedNotes(1)
    await user.click(rootChip('E♭'))
    const nodes = await soundedNotes(2)

    expect(nodes[1].start).toHaveBeenCalledTimes(1)
    expect(fetchedNotes()).toEqual([noteSrc('E♭')])
    expect(nodes[1].buffer).toBe(nodes[0].buffer)
    expect(rootChip('E♭')).toHaveAttribute('aria-pressed', 'true')
  })

  it('stays silent once the day is solved (R12, AC10)', async () => {
    const user = userEvent.setup()
    await openDay({ attempts: [SOLVING], solved: true })

    await user.click(rootChip('D'))
    await settle()

    expect(fetchedNotes()).toEqual([])
    expect(fake.sources).toHaveLength(0)
    expect(pressedIn(rootGroup())).toEqual(['C'])
  })

  it('stays silent once the day has been revealed (R12, AC10)', async () => {
    const user = userEvent.setup()
    await openDay({ attempts: threeMisses(), revealed: true })

    await user.click(rootChip('C'))
    await settle()

    expect(fetchedNotes()).toEqual([])
    expect(fake.sources).toHaveLength(0)
  })

  it('sounds every root a narrowed row offers (R7, AC6)', async () => {
    const user = userEvent.setup()
    await seedPreferences({ simpleMode: true })
    await openDay()

    const six = chipsIn(rootGroup()).map(chipLabel)
    expect(six).toEqual(simpleRootOptions(new Date(), ANSWER))

    for (const root of six) await user.click(rootChip(root))

    await soundedNotes(six.length)
    expect(fetchedNotes()).toEqual(six.map((root) => noteSrc(root)))
  })

  it('never asks for a note when a mode chip is tapped (R1)', async () => {
    const user = userEvent.setup()
    await openDay()

    const mode = flavours()[0]
    await user.click(modeChip(mode))

    await soundedNotes(lickLength(mode))
    expect(fake.sources).toHaveLength(lickLength(mode))
    expect(fetchedNotes()).toEqual(lickFiles(mode))
    expect(pressedIn(rootGroup())).toEqual([])
  })

  it('still disarms the give-up control when a root is tapped (F7 E3 R6b)', async () => {
    const user = userEvent.setup()
    await openDay({ attempts: threeMisses() })

    await user.click(screen.getByRole('button', { name: GIVE_UP }))
    await user.click(rootChip('C'))

    await user.click(screen.getByRole('button', { name: GIVE_UP }))
    expect(ended()).toBeNull()
    expect(confirm()).toBeInTheDocument()
  })

  it('reports the mode and asks for its lick on the same tap (R1, R2, AC1)', async () => {
    const user = userEvent.setup()
    await openDay()

    const mode = flavours()[1]
    await user.click(modeChip(mode))

    expect(modeChip(mode)).toHaveAttribute('aria-pressed', 'true')
    const nodes = await soundedNotes(lickLength(mode))
    for (const node of nodes) expect(node.start).toHaveBeenCalledTimes(1)
    expect(fetchedNotes()).toEqual(lickFiles(mode))
  })

  it('asks again when the mode already selected is tapped again (R1, AC2)', async () => {
    const user = userEvent.setup()
    await openDay()

    const mode = flavours()[0]
    const length = lickLength(mode)
    await user.click(modeChip(mode))
    await soundedNotes(length)
    await user.click(modeChip(mode))
    const nodes = await soundedNotes(length * 2)

    expect(fetchedNotes()).toEqual(lickFiles(mode))
    for (let index = 0; index < length; index += 1) {
      expect(nodes[length + index].buffer).toBe(nodes[index].buffer)
    }
    expect(modeChip(mode)).toHaveAttribute('aria-pressed', 'true')
  })

  it('leaves the line and the control untouched by mode taps (R3, AC3)', async () => {
    const user = userEvent.setup()
    await openDay()

    const [first, second] = flavours()
    await user.click(modeChip(first))

    const before = {
      line: cardStatus().textContent,
      label: control().textContent,
      disabled: (control() as HTMLButtonElement).disabled,
    }

    for (const mode of [second, first, second]) {
      await user.click(modeChip(mode))
    }

    expect(cardStatus().textContent).toBe(before.line)
    expect(control().textContent).toBe(before.label)
    expect((control() as HTMLButtonElement).disabled).toBe(before.disabled)
    expect(dimmedIn(flavourGroup())).toEqual([])
  })

  it.each([
    ['solved', () => ({ attempts: [SOLVING], solved: true })],
    ['revealed', () => ({ attempts: threeMisses(), revealed: true })],
  ])('stays silent on a %s day (R22, AC15)', async (_name, over) => {
    const user = userEvent.setup()
    await openDay(over())

    const pressed = pressedIn(flavourGroup())
    const target = chipsIn(flavourGroup())
      .map(chipLabel)
      .find((mode) => !pressed.includes(mode)) as string
    await user.click(modeChip(target))
    await settle()

    expect(fetchedNotes()).toEqual([])
    expect(fake.sources).toHaveLength(0)
    expect(pressedIn(flavourGroup())).not.toContain(target)
  })

  it('sounds every option a narrowed mode row offers (R15, AC11)', async () => {
    const user = userEvent.setup()
    await seedPreferences({ simpleMode: true })
    await openDay()

    expect(chipsIn(flavourGroup()).map(chipLabel)).toEqual(FAMILIES)

    const resolved = (family: Family) =>
      simpleLickMode({
        family,
        answer: ANSWER,
        pool: flavourPool(GROOVES),
        date: new Date(),
      }) as Flavour

    const major = resolved('Major')
    const minor = resolved('Minor')
    expect(major).not.toBe(minor)

    await user.click(modeChip('Major'))
    await soundedNotes(lickPhrase(major).length)
    expect(fetchedNotes()).toEqual(lickFiles(major))

    await user.click(modeChip('Minor'))
    await soundedNotes(lickPhrase(major).length + lickPhrase(minor).length)
    expect(fetchedNotes()).toEqual(lickFiles(major, minor))
  })

  it('still disarms the give-up control when a mode is tapped (F7 E3 R6b)', async () => {
    const user = userEvent.setup()
    await openDay({ attempts: threeMisses() })

    await user.click(screen.getByRole('button', { name: GIVE_UP }))
    await user.click(modeChip('Aeolian'))

    await user.click(screen.getByRole('button', { name: GIVE_UP }))
    expect(ended()).toBeNull()
    expect(confirm()).toBeInTheDocument()
  })

  it('never asks for a lick when a root chip is tapped (R1)', async () => {
    const user = userEvent.setup()
    await openDay()

    await user.click(rootChip('C'))

    await soundedNotes(1)
    expect(fake.sources).toHaveLength(1)
    expect(fetchedNotes()).toEqual([noteSrc('C')])
    expect(pressedIn(flavourGroup())).toEqual([])
  })

  describe('the note glyph on the root row (F10 E2)', () => {
    it('marks every root chip with the glyph (R1, R2, AC1)', async () => {
      await openDay()

      const roots = chipsIn(rootGroup())
      expect(roots).toHaveLength(12)
      for (const chip of roots) {
        expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
        expect(chip.textContent, chipLabel(chip)).toBe(
          `${NOTE_GLYPH}${chipLabel(chip)}`,
        )
      }
    })

    it('leaves a root chip’s accessible name its label alone (R4, AC5)', async () => {
      await openDay()

      for (const root of ROOTS) {
        expect(rootChip(root)).toHaveAccessibleName(root)
      }
      expect(
        within(rootGroup()).queryByRole('button', { name: /♪/ }),
      ).toBeNull()
    })

    it('gives the marked row and the unmarked row identical chips (R8, AC10)', async () => {
      await openDay()

      const classesOf = (group: HTMLElement) =>
        chipsIn(group).map((chip) => chip.className)

      const roots = classesOf(rootGroup())
      const modes = classesOf(flavourGroup())

      expect(new Set([...roots, ...modes]).size).toBe(1)
    })

    it('marks all six root chips in simple mode (R3, AC3)', async () => {
      await seedPreferences({ simpleMode: true })
      await openDay()

      const chips = chipsIn(rootGroup())
      expect(chips).toHaveLength(6)
      expect(chips.map(chipLabel)).toEqual(simpleRootOptions(new Date(), ANSWER))
      for (const chip of chips) expect(chipAdornment(chip)).toBe(NOTE_GLYPH)
    })

    it.each([
      ['solved', () => ({ attempts: [SOLVING], solved: true })],
      [
        'revealed',
        () => ({
          attempts: [miss('C', wrongFlavour(), true)],
          revealed: true,
        }),
      ],
    ])(
      'keeps the glyph on the disabled chips of a %s day (R3, AC4)',
      async (_name, over) => {
        await openDay(over())

        const chips = chipsIn(rootGroup())
        for (const chip of chips) {
          expect(chip).toBeDisabled()
          expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
        }
        const selected = rootChip('C')
        expect(selected).toHaveAttribute('aria-pressed', 'true')
        expect(chipAdornment(selected)).toBe(NOTE_GLYPH)
      },
    )

    it('leaves the two rows built the same way (R8, AC10)', async () => {
      await openDay()

      const rootFirst = chipsIn(rootGroup())[0]
      const modeFirst = chipsIn(flavourGroup())[0]
      expect(rootFirst.className).toBe(modeFirst.className)
    })
  })

  describe('the note glyph on the mode row (F16 E1)', () => {
    it('marks every mode chip with the same glyph the roots wear (R23, AC16)', async () => {
      await openDay()

      const modes = chipsIn(flavourGroup())
      expect(modes).toHaveLength(flavours().length)
      for (const chip of modes) {
        expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
        expect(chip.textContent, chipLabel(chip)).toBe(
          `${NOTE_GLYPH}${chipLabel(chip)}`,
        )
      }

      const rootMarks = chipsIn(rootGroup()).map(chipAdornment)
      expect(new Set([...rootMarks, ...modes.map(chipAdornment)]).size).toBe(1)
    })

    it('leaves a mode chip’s accessible name its label alone (R24, AC16)', async () => {
      await openDay()

      for (const flavour of flavours()) {
        const chip = modeChip(flavour)
        expect(chip).toHaveAccessibleName(flavour)
        expect(chip.querySelector('[aria-hidden="true"]')?.textContent).toBe(
          NOTE_GLYPH,
        )
      }
      expect(
        within(flavourGroup()).queryByRole('button', { name: /♪/ }),
      ).toBeNull()
    })

    it('marks both options in simple mode (R23, AC16)', async () => {
      await seedPreferences({ simpleMode: true })
      await openDay()

      const chips = chipsIn(flavourGroup())
      expect(chips.map(chipLabel)).toEqual(FAMILIES)
      for (const chip of chips) {
        expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
        expect(chip).toHaveAccessibleName(chipLabel(chip))
      }
    })

    it.each([
      ['solved', () => ({ attempts: [SOLVING], solved: true })],
      [
        'revealed',
        () => ({ attempts: [flavourHit('G', 'Aeolian')], revealed: true }),
      ],
    ])(
      'keeps the glyph on the disabled mode chips of a %s day',
      async (_name, over) => {
        await openDay(over())

        for (const chip of chipsIn(flavourGroup())) {
          expect(chip).toBeDisabled()
          expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
        }
        const selected = modeChip('Aeolian')
        expect(selected).toHaveAttribute('aria-pressed', 'true')
        expect(chipAdornment(selected)).toBe(NOTE_GLYPH)
      },
    )
  })

  describe('the tap-sounds switch (F16 E2)', () => {
    it('sits directly below the simple-mode toggle, above both rows (R1, AC1)', async () => {
      await openDay()

      expect(precedes(modeSwitch(), soundSwitch())).toBe(true)
      expect(precedes(soundSwitch(), rootGroup())).toBe(true)
      expect(precedes(soundSwitch(), flavourGroup())).toBe(true)
    })

    it('shares its stack with the simple-mode toggle (R1, R14, AC1)', async () => {
      await openDay()

      expect(soundSwitch().parentElement).toBe(modeSwitch().parentElement)
    })

    it('reports the state the player asked for, not the one they left (R1)', async () => {
      const user = userEvent.setup()
      await openDay()

      expect(soundSwitch()).toHaveAttribute('aria-checked', 'true')
      await user.click(soundSwitch())

      expect(soundSwitch()).toHaveAttribute('aria-checked', 'false')
      for (const chip of chipsIn(rootGroup())) {
        expect(chipAdornment(chip), chipLabel(chip)).toBeNull()
      }
    })

    it('asks to turn the sounds back on when they are off (R1, R4)', async () => {
      const user = userEvent.setup()
      await seedPreferences({ tapSounds: false })
      await openDay()

      expect(soundSwitch()).toHaveAttribute('aria-checked', 'false')
      await user.click(soundSwitch())

      expect(soundSwitch()).toHaveAttribute('aria-checked', 'true')
      for (const chip of chipsIn(rootGroup())) {
        expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
      }
    })

    it.each([
      ['solved', () => ({ attempts: [SOLVING], solved: true })],
      ['revealed', () => ({ attempts: threeMisses(), revealed: true })],
    ])(
      'stays live on a %s day while the mode switch settles (R5a, AC11b)',
      async (_name, over) => {
        const user = userEvent.setup()
        await openDay(over())

        expect(modeSwitch()).toBeDisabled()
        expect(soundSwitch()).toBeEnabled()

        await user.click(soundSwitch())
        expect(soundSwitch()).toHaveAttribute('aria-checked', 'false')
      },
    )

    it('marks both rows while the sounds are on (R12, AC11)', async () => {
      await openDay()

      for (const group of [rootGroup(), flavourGroup()]) {
        for (const chip of chipsIn(group)) {
          expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
        }
      }
    })

    it('takes the mark off both rows while the sounds are off (R12, AC11)', async () => {
      await seedPreferences({ tapSounds: false })
      await openDay()

      for (const group of [rootGroup(), flavourGroup()]) {
        for (const chip of chipsIn(group)) {
          expect(chipAdornment(chip), chipLabel(chip)).toBeNull()
        }
      }
    })

    it('keeps the mark on a ruled-out chip while the sounds are on (R4c, AC5c)', async () => {
      await openDay({ attempts: twoMisses() })

      expect(dimmedIn(rootGroup()).length).toBeGreaterThan(0)
      expect(dimmedIn(flavourGroup()).length).toBeGreaterThan(0)
      for (const group of [rootGroup(), flavourGroup()]) {
        for (const chip of chipsIn(group)) {
          expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
        }
      }
    })

    it('takes the mark off a ruled-out chip too while the sounds are off (R4c, AC5c)', async () => {
      await seedPreferences({ tapSounds: false })
      await openDay({ attempts: twoMisses() })

      expect(dimmedIn(rootGroup()).length).toBeGreaterThan(0)
      expect(dimmedIn(flavourGroup()).length).toBeGreaterThan(0)
      for (const group of [rootGroup(), flavourGroup()]) {
        for (const chip of chipsIn(group)) {
          expect(chipAdornment(chip), chipLabel(chip)).toBeNull()
        }
      }
    })

    it('leaves both rows offering exactly what they offered (R12, AC11)', async () => {
      const marked = await openDay()
      const before = {
        roots: chipsIn(rootGroup()).map(chipLabel),
        modes: chipsIn(flavourGroup()).map(chipLabel),
      }
      marked.unmount()

      await seedPreferences({ tapSounds: false })
      await openDay()

      expect(chipsIn(rootGroup()).map(chipLabel)).toEqual(before.roots)
      expect(chipsIn(flavourGroup()).map(chipLabel)).toEqual(before.modes)
      for (const root of ROOTS) {
        expect(rootChip(root)).toHaveAccessibleName(root)
      }
    })

    it('changes nothing else on the card when it is flipped (R5, AC5)', async () => {
      const user = userEvent.setup()
      await openDay()

      await user.click(rootChip('G'))
      await user.click(modeChip(wrongFlavour()))

      const before = {
        line: cardStatus().textContent,
        label: control().textContent,
        pressed: within(card())
          .getAllByRole('button')
          .filter((b) => b.getAttribute('aria-pressed') === 'true')
          .map(chipLabel),
      }

      await user.click(soundSwitch())

      expect(cardStatus().textContent).toBe(before.line)
      expect(control().textContent).toBe(before.label)
      expect(
        within(card())
          .getAllByRole('button')
          .filter((b) => b.getAttribute('aria-pressed') === 'true')
          .map(chipLabel),
      ).toEqual(before.pressed)
      expect(dimmedIn(rootGroup())).toEqual([])
    })

    it('disarms an armed give-up when the sounds are switched instead (F7 E3 R6b)', async () => {
      const user = userEvent.setup()
      await openDay({ attempts: threeMisses() })

      await user.click(giveUp() as HTMLElement)
      expect(confirm()).toBeInTheDocument()

      await user.click(soundSwitch())

      expect(ended()).toBeNull()
      expect(confirm()).not.toBeInTheDocument()
      expect(giveUp()).toBeInTheDocument()
    })
  })

  describe('the row locks once a check confirms a half (F17 E2)', () => {
    const LOCK_GROOVE: Groove = {
      ...GROOVE,
      root: 'C♯',
      flavour: LONGEST_FLAVOUR,
      scale: `C♯ ${LONGEST_FLAVOUR}`,
    }

    it('takes every other root out of the row when the root is confirmed (R1, R7, AC1, AC9)', async () => {
      await openDay({ attempts: [miss('C', OFF_ROW_FLAVOUR, true)] })
      const c = rootChip('C')

      expect(c).not.toHaveAttribute('aria-disabled')
      expect(dimmedIn(rootGroup())).toEqual(ROOTS.filter((r) => r !== 'C'))
      expect(dimmedIn(flavourGroup())).toEqual([])
      for (const chip of chipsIn(rootGroup())) {
        expect(chip, chipLabel(chip)).toBeEnabled()
      }
    })

    it('takes every other mode out, and the other family in simple mode (R1, R6, AC2, AC8)', async () => {
      const full = await openDay({ attempts: [flavourHit('G', 'Aeolian')] })

      expect(dimmedIn(flavourGroup())).toEqual(
        flavours().filter((f) => f !== 'Aeolian'),
      )
      expect(dimmedIn(rootGroup())).toEqual(['G'])
      expect(liveIn(rootGroup())).toHaveLength(11)
      full.unmount()

      await seedPreferences({ simpleMode: true })
      await openDay({ attempts: [flavourHit('G', 'Minor')] })

      expect(dimmedIn(flavourGroup())).toEqual(['Major'])
      expect(modeChip('Minor')).not.toHaveAttribute('aria-disabled')
    })

    it('leaves the row unlocked when the confirmed value is not one it offers, in both directions (R6, AC8)', async () => {
      await seedPreferences({ simpleMode: true })
      const simple = await openDay({
        attempts: [flavourHit('G', 'Aeolian')],
      })

      expect(liveIn(flavourGroup())).toEqual(FAMILIES)
      expect(dimmedIn(flavourGroup())).toEqual([])
      simple.unmount()

      await seedPreferences({ simpleMode: false })
      await openDay({ attempts: [flavourHit('G', 'Minor')] })

      expect(liveIn(flavourGroup())).toEqual(flavours())
      expect(dimmedIn(flavourGroup())).toEqual([])
    })

    it('falls back to the ruled-out dimming when no confirmed value is offered (R6, R9c, AC8)', async () => {
      const six = simpleRootOptions(new Date(), ANSWER)
      const inside = six.filter((root) => root !== 'C')
      const outside = ROOTS.filter((root) => !six.includes(root))

      await seedPreferences({ simpleMode: true })
      await openDay({
        attempts: [
          miss(inside[0], wrongFlavour(), false),
          miss(inside[1], otherWrongFlavour(), false),
          miss(outside[0], thirdWrongFlavour(), true),
          flavourHit(outside[1], 'Aeolian'),
        ],
      })

      const out: Root[] = [inside[0], inside[1]]
      expect(dimmedIn(rootGroup())).toEqual(six.filter((r) => out.includes(r)))
      expect(liveIn(rootGroup())).toEqual(six.filter((r) => !out.includes(r)))
      expect(dimmedIn(flavourGroup())).toEqual([])
      expect(liveIn(flavourGroup())).toEqual(FAMILIES)
    })

    it.each([
      [
        'a mode confirmed in full mode, read by the simple row',
        () => ({
          prefs: { simpleMode: true },
          attempts: [
            flavourHit('G', 'Aeolian'),
            miss('D', 'Major', false),
          ],
        }),
      ],
      [
        'a family confirmed in simple mode, read by the full row',
        () => ({
          prefs: {},
          attempts: [
            flavourHit('G', 'Minor'),
            miss('D', wrongFlavour(), false),
            miss('E', otherWrongFlavour(), false),
          ],
        }),
      ],
      [
        'a root the narrowed row no longer offers',
        () => {
          const six = simpleRootOptions(new Date(), ANSWER)
          const inside = six.filter((root) => root !== 'C')
          const outside = ROOTS.filter((root) => !six.includes(root))
          return {
            prefs: { simpleMode: true },
            attempts: [
              miss(outside[0], wrongFlavour(), true),
              miss(inside[0], otherWrongFlavour(), false),
              miss(inside[1], thirdWrongFlavour(), false),
            ],
          }
        },
      ],
      [
        'both halves confirmed and offered, with ruled-out options besides',
        () => ({
          prefs: {},
          attempts: [
            miss('C', wrongFlavour(), true),
            flavourHit('G', 'Aeolian'),
            miss('D', otherWrongFlavour(), false),
          ],
        }),
      ],
      [
        'a stale confirmed half on one row and a live one on the other',
        () => ({
          prefs: {},
          attempts: [
            miss('C', wrongFlavour(), true),
            flavourHit('G', 'Minor'),
            miss('D', otherWrongFlavour(), false),
          ],
        }),
      ],
      [
        'every option on both rows named as ruled out',
        () => ({
          prefs: {},
          attempts: [
            miss('C', wrongFlavour(), true),
            flavourHit('G', 'Aeolian'),
            miss('D', otherWrongFlavour(), false),
            miss('E', thirdWrongFlavour(), false),
          ],
        }),
      ],
    ])(
      'always keeps at least one live chip in each row: %s (R6, R9c, AC8)',
      async (_name, rung) => {
        const { prefs, attempts } = rung()
        if (Object.keys(prefs).length > 0) await seedPreferences(prefs)
        await openDay({ attempts })

        expect(
          liveIn(rootGroup()),
          'the root row must always offer a live chip',
        ).not.toEqual([])
        expect(
          liveIn(flavourGroup()),
          'the mode row must always offer a live chip',
        ).not.toEqual([])
      },
    )

    it('adds no glyph to any chip, at the longest label either row offers (R1a, R9b, AC3)', async () => {
      expect(Math.max(...ROOTS.map((root) => root.length))).toBe(2)
      expect(LONGEST_FLAVOUR).toHaveLength(17)

      const otherMode = flavourOptions(new Date(), LOCK_GROOVE, GROOVES).find(
        (flavour) => flavour !== LONGEST_FLAVOUR,
      ) as Flavour
      const lockedAttempts = [
        miss('C♯', otherMode, true),
        flavourHit('G', LONGEST_FLAVOUR),
      ]

      await seedDay(
        storedDay({
          answer: { root: 'C♯', flavour: LONGEST_FLAVOUR },
          attempts: lockedAttempts,
        }),
      )
      const locked = await renderPuzzle(<GroovePuzzle groove={LOCK_GROOVE} />)

      for (const group of [rootGroup(), flavourGroup()]) {
        for (const chip of chipsIn(group)) {
          expect(chip.children, chipLabel(chip)).toHaveLength(1)
          expect(chip.textContent).toBe(`${NOTE_GLYPH}${chipLabel(chip)}`)
          expect(chip).toHaveAccessibleName(chipLabel(chip))
          for (const cut of [
            /\btruncate\b/,
            /\btext-ellipsis\b/,
            /\boverflow-hidden\b/,
          ]) {
            expect(chip.className).not.toMatch(cut)
          }
        }
      }
      locked.unmount()

      await seedPreferences({ tapSounds: false })
      await seedDay(
        storedDay({
          answer: { root: 'C♯', flavour: LONGEST_FLAVOUR },
          attempts: [miss('C♯', otherMode, true)],
        }),
      )
      await renderPuzzle(<GroovePuzzle groove={LOCK_GROOVE} />)

      for (const chip of chipsIn(rootGroup())) {
        expect(chip.children, chipLabel(chip)).toHaveLength(0)
        expect(chip.textContent).toBe(chipLabel(chip))
      }
    })

    it('locks nothing until something is confirmed, selection included (R2, AC4)', async () => {
      const user = userEvent.setup()
      await openDay()

      expect(dimmedIn(rootGroup())).toEqual([])
      expect(dimmedIn(flavourGroup())).toEqual([])

      await user.click(rootChip('G'))
      await user.click(modeChip(wrongFlavour()))

      expect(dimmedIn(rootGroup())).toEqual([])
      expect(dimmedIn(flavourGroup())).toEqual([])
    })

    it('keeps the confirmed chip live, selected and selectable (R4, R7, AC6, AC9)', async () => {
      const user = userEvent.setup()
      await openDay({ attempts: [miss('C', OFF_ROW_FLAVOUR, true)] })
      const c = rootChip('C')

      expect(c).toHaveAttribute('aria-pressed', 'true')
      expect(c).not.toHaveAttribute('aria-disabled')

      await user.click(c)

      expect(pressedIn(rootGroup())).toEqual(['C'])
      await soundedNotes(1)
      expect(fetchedNotes()).toEqual([noteSrc('C')])
    })

    it('still sounds a locked-out chip, and refuses the pick (R9, AC10a)', async () => {
      const user = userEvent.setup()
      await openDay({ attempts: [miss('C', OFF_ROW_FLAVOUR, true)] })
      const out = rootChip('B♭')

      expect(out).toHaveAttribute('aria-disabled', 'true')

      await user.click(out)

      expect(pressedIn(rootGroup())).toEqual(['C'])
      await soundedNotes(1)
      expect(fetchedNotes()).toEqual([noteSrc('B♭')])
    })

    it('keeps the ♪ on every chip in a locked row, and drops it row-wide (R9a, AC10b)', async () => {
      const attempts = [
        miss('C', wrongFlavour(), true),
        flavourHit('G', 'Aeolian'),
      ]
      const on = await openDay({ attempts })

      for (const group of [rootGroup(), flavourGroup()]) {
        for (const chip of chipsIn(group)) {
          expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
        }
      }
      expect(dimmedIn(rootGroup())).toHaveLength(11)
      on.unmount()

      await seedPreferences({ tapSounds: false })
      await openDay({ attempts })

      for (const group of [rootGroup(), flavourGroup()]) {
        for (const chip of chipsIn(group)) {
          expect(chipAdornment(chip), chipLabel(chip)).toBeNull()
        }
      }
    })

    it.each([
      [{ solved: true }, () => ({ attempts: [miss('C', OFF_ROW_FLAVOUR, true), SOLVING], solved: true })],
      [{ revealed: true }, () => ({ attempts: [miss('C', OFF_ROW_FLAVOUR, true)], revealed: true })],
    ])(
      'still reads as locked under the day’s own lock (%o) (R8, AC10)',
      async (_terminal, rung) => {
        await openDay(rung())
        const c = rootChip('C')

        expect(dimmedIn(rootGroup())).toEqual(ROOTS.filter((r) => r !== 'C'))
        expect(c).not.toHaveAttribute('aria-disabled')
        expect(c).toBeDisabled()
        expect(c).toHaveAccessibleName('C')
        for (const chip of chipsIn(rootGroup())) {
          expect(chip, chipLabel(chip)).toBeDisabled()
        }
      },
    )

    it('moves nothing on the card when a row locks (R9b, AC10c)', async () => {
      const GEOMETRY =
        /^(w-|h-|min-|max-|p[xytblrse]?-|-?m[xytblrse]?-|grid|col-|row-|gap-|flex|absolute|relative|fixed|sticky|-?translate|text-\[|leading-|border-\[|border-[0-9])/
      const chipClasses = () =>
        [rootGroup(), flavourGroup()].flatMap((group) =>
          chipsIn(group).map((chip) => chip.className),
        )
      const rowClasses = () =>
        [rootGroup(), flavourGroup()].map((group) => chipList(group).className)

      const user = userEvent.setup()
      const open = await openDay()
      await user.click(modeChip('Aeolian'))
      const before = { chips: chipClasses(), rows: rowClasses() }
      open.unmount()

      await openDay({
        attempts: [miss('C', wrongFlavour(), true), flavourHit('G', 'Aeolian')],
      })
      const after = { chips: chipClasses(), rows: rowClasses() }

      expect(after.rows).toEqual(before.rows)
      expect(after.chips).toHaveLength(before.chips.length)
      after.chips.forEach((className, index) => {
        const was = before.chips[index].split(/\s+/).filter(Boolean)
        const now = className.split(/\s+/).filter(Boolean)
        expect(was.filter((name) => !now.includes(name))).toEqual([])
        expect(
          now
            .filter((name) => !was.includes(name))
            .filter((name) => GEOMETRY.test(name)),
          'locking a row may not add a class that changes a chip’s box',
        ).toEqual([])
      })
    })
  })
})

describe('through the composed page', () => {
  beforeEach(() => {
    clearStored()
  })

  it("offers today's deterministic flavour options", async () => {
    await renderFeature()

    const today = new Date()
    const groove = selectGrooveForDate(today, GROOVES)
    const expected = flavourOptions(today, groove, GROOVES)
    const modes = screen.getByRole('radiogroup', { name: 'Mode' })

    expect(within(modes).getAllByRole('button').map(chipLabel)).toEqual(expected)
  })

  it("offers all twelve roots, in the design's order", async () => {
    await renderFeature()

    const roots = screen.getByRole('radiogroup', { name: 'Root' })
    expect(within(roots).getAllByRole('button').map(chipLabel)).toEqual(ROOTS)
  })

  it('names the chosen pair on the check control once both are picked (AC6)', async () => {
    const user = userEvent.setup()
    await renderFeature()

    expect(control()).toHaveAccessibleName('Pick a root and a mode')
    expect(control()).toBeDisabled()

    const roots = screen.getByRole('radiogroup', { name: 'Root' })
    const modes = screen.getByRole('radiogroup', { name: 'Mode' })
    await user.click(within(roots).getByRole('button', { name: 'G' }))
    const firstMode = within(modes).getAllByRole('button')[0]
    await user.click(firstMode)

    expect(control()).toHaveAccessibleName(`Check G ${chipLabel(firstMode)}`)
    expect(control()).toBeEnabled()
  })
})
