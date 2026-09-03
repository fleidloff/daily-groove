import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Flavour, Root } from '../../types'
import { ROOTS, flavourOptions } from '../../lib/theory/music'
import { GROOVES } from '../../data/grooves.generated'
import { selectGrooveForDate } from '../../lib/puzzle/selectGroove'
import { renderFeature } from '../../testing/renderFeature'
import type { Feedback } from '../../lib/presentation/feedback'
import { PlayControl } from '@/components/controls/PlayControl'
import { GuessCard } from './GuessCard'

const FLAVOURS: Flavour[] = ['Dorian', 'Mixolydian', 'Lydian', 'Aeolian']

const OPENING: Feedback = {
  message: 'Sing the note that feels like rest.',
  tone: 'neutral',
}
const ROOT_MATCHED: Feedback = {
  message: 'Right home note, wrong colour.',
  tone: 'warm',
}
const SOLVED: Feedback = {
  message: 'That is it. The groove is yours now.',
  tone: 'solved',
}
const MOVE: Feedback = {
  message: 'Hum the bass note on beat one.',
  tone: 'neutral',
}


type Props = Parameters<typeof GuessCard>[0]

function props(overrides: Partial<Props> = {}): Props {
  return {
    roots: ROOTS,
    flavours: FLAVOURS,
    selectedRoot: null,
    selectedFlavour: null,
    onSelectRoot: vi.fn(),
    onSelectFlavour: vi.fn(),
    onHearRoot: vi.fn(),
    onHearMode: vi.fn(),
    canCheck: false,
    onCheck: vi.fn(),
    solved: false,
    feedback: OPENING,
    coaching: MOVE,
    showVerdict: true,
    showNudge: false,
    ruledOutRoots: [],
    ruledOutFlavours: [],
    confirmedRoots: [],
    confirmedFlavours: [],
    eliminated: 0,
    revealed: false,
    showReveal: false,
    onReveal: vi.fn(),
    simple: false,
    onToggleSimple: vi.fn(),
    tapSounds: true,
    onToggleTapSounds: vi.fn(),
    ...overrides,
  }
}

const rootGroup = () => screen.getByRole('radiogroup', { name: 'Root' })
const flavourGroup = () => screen.getByRole('radiogroup', { name: 'Mode' })
const NOTE_GLYPH = '♪'
const chipLabel = (chip: Element) =>
  Array.from(chip.childNodes)
    .filter(
      (node) =>
        !(
          node instanceof Element &&
          node.getAttribute('aria-hidden') === 'true'
        ),
    )
    .map((node) => node.textContent ?? '')
    .join('')
const chipAdornment = (chip: Element) =>
  chip.querySelector('[aria-hidden="true"]')?.textContent ?? null
const chipList = (group: HTMLElement) =>
  group.querySelector('[data-testid="chip-list"]') as HTMLElement
const hintBox = () => screen.getByRole('complementary', { name: 'Hint' })
const hintQuery = () =>
  screen.queryByRole('complementary', { name: 'Hint' })
const nudgeLine = () => screen.queryByText(/roots ruled out/i)
const modeSwitch = () => screen.getByRole('switch', { name: /simple mode/i })
const soundSwitch = () => screen.getByRole('switch', { name: /tap sounds/i })
const precedes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
const MODE_NAME = /ionian|dorian|phrygian|lydian|mixolydian|aeolian|locrian/i
const FAMILIES: Flavour[] = ['Major', 'Minor']
const LONGEST_FLAVOUR = [...new Set(GROOVES.map((g) => g.flavour))].sort(
  (a, b) => b.length - a.length,
)[0]

describe('GuessCard', () => {
  it('labels the second chip row "Mode", not "Flavour" (R1, AC1)', () => {
    render(<GuessCard {...props()} />)

    expect(screen.getByRole('radiogroup', { name: 'Mode' })).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Flavour' })).toBeNull()
  })

  it('offers twelve root chips and exactly four flavour chips (AC1)', () => {
    render(<GuessCard {...props()} />)

    expect(within(rootGroup()).getAllByRole('button')).toHaveLength(12)
    expect(within(flavourGroup()).getAllByRole('button')).toHaveLength(4)
  })

  it('renders the roots and flavours it is given, in order (R1, R2, R3)', () => {
    render(<GuessCard {...props()} />)

    expect(
      within(rootGroup()).getAllByRole('button').map(chipLabel),
    ).toEqual(ROOTS)
    expect(
      within(flavourGroup()).getAllByRole('button').map(chipLabel),
    ).toEqual(FLAVOURS)
  })

  it('reports a chip choice to the matching handler (R5)', async () => {
    const user = userEvent.setup()
    const onSelectRoot = vi.fn()
    const onSelectFlavour = vi.fn()
    render(<GuessCard {...props({ onSelectRoot, onSelectFlavour })} />)

    await user.click(within(rootGroup()).getByRole('button', { name: 'G' }))
    expect(onSelectRoot).toHaveBeenCalledWith('G')

    await user.click(
      within(flavourGroup()).getByRole('button', { name: 'Dorian' }),
    )
    expect(onSelectFlavour).toHaveBeenCalledWith('Dorian')
  })

  it('marks only the current selection in each group (R5, AC5)', () => {
    render(
      <GuessCard
        {...props({ selectedRoot: 'G' as Root, selectedFlavour: 'Dorian' })}
      />,
    )

    const pressedRoots = within(rootGroup())
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressedRoots.map(chipLabel)).toEqual(['G'])

    const pressedFlavours = within(flavourGroup())
      .getAllByRole('button')
      .filter((b) => b.getAttribute('aria-pressed') === 'true')
    expect(pressedFlavours.map(chipLabel)).toEqual(['Dorian'])
  })

  it('prompts and stays disabled until both halves are chosen (R7, AC6)', () => {
    render(<GuessCard {...props()} />)

    expect(
      screen.getByRole('button', { name: 'Pick a root and a mode' }),
    ).toBeDisabled()
  })

  it('names the chosen pair once both are selected (R8, AC6)', () => {
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          canCheck: true,
        })}
      />,
    )

    expect(screen.getByRole('button', { name: 'Check G Dorian' })).toBeEnabled()
    expect(
      screen.queryByRole('button', { name: 'Pick a root and a mode' }),
    ).not.toBeInTheDocument()
  })

  it('keeps prompting while only one half is chosen (R7)', () => {
    render(<GuessCard {...props({ selectedRoot: 'G' as Root })} />)
    expect(screen.getByRole('button', { name: 'Pick a mode' })).toBeDisabled()
  })

  const CTA_CASES: [string, Partial<Props>, string][] = [
    ['a root chosen', { selectedRoot: 'G' as Root }, 'Pick a mode'],
    ['a mode chosen', { selectedFlavour: 'Dorian' }, 'Pick a root'],
    ['neither chosen', {}, 'Pick a root and a mode'],
    [
      'both chosen',
      { selectedRoot: 'G' as Root, selectedFlavour: 'Dorian', canCheck: true },
      'Check G Dorian',
    ],
    [
      'a solved day',
      {
        selectedRoot: 'G' as Root,
        selectedFlavour: 'Dorian',
        solved: true,
        feedback: SOLVED,
      },
      'Solved',
    ],
  ]

  it.each(CTA_CASES)(
    'asks for the half that is missing with %s (R19c, AC19b)',
    (_name, selection, label) => {
      render(<GuessCard {...props(selection)} />)

      expect(screen.getByRole('button', { name: label })).toBeInTheDocument()
    },
  )

  it('calls onCheck when the enabled control is pressed (R7)', async () => {
    const user = userEvent.setup()
    const onCheck = vi.fn()
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          canCheck: true,
          onCheck,
        })}
      />,
    )

    await user.click(screen.getByRole('button', { name: 'Check G Dorian' }))
    expect(onCheck).toHaveBeenCalledTimes(1)
  })

  it('renders no count of the player’s guesses (F19 E1 R1, R2, AC1)', () => {
    render(<GuessCard {...props()} />)

    expect(document.querySelectorAll('[data-dot-state]')).toHaveLength(0)
    expect(screen.queryByRole('img')).toBeNull()
    expect(
      screen.getByRole('button', { name: 'Pick a root and a mode' })
        .previousElementSibling,
    ).toBe(flavourGroup())
  })

  it('shows the feedback it is given in a live region (R3, R4, AC4, AC14)', () => {
    render(<GuessCard {...props()} />)

    const region = screen.getByRole('status')
    expect(region).toContainElement(screen.getByText(OPENING.message))
    expect(region).toHaveAttribute('aria-live', 'polite')
  })

  it('shows the coaching under the verdict in the hint box (R12, AC11)', () => {
    render(
      <GuessCard
        {...props({
          feedback: ROOT_MATCHED,
          coaching: MOVE,
        })}
      />,
    )

    const box = hintBox()
    const verdict = screen.getByText(ROOT_MATCHED.message)
    const move = screen.getByText(MOVE.message)

    expect(box).toContainElement(verdict)
    expect(box).toContainElement(move)
    expect(precedes(verdict, move)).toBe(true)
    expect(move).toHaveAttribute('data-tone', 'neutral')
  })

  it('carries the coaching alone when the verdict is suppressed (R12a, AC16)', () => {
    render(
      <GuessCard
        {...props({
          showVerdict: false,
          feedback: ROOT_MATCHED,
          coaching: MOVE,
        })}
      />,
    )

    expect(hintBox()).toHaveTextContent(MOVE.message)
    expect(screen.queryByText(ROOT_MATCHED.message)).toBeNull()
  })

  it('shows targeted feedback after a wrong guess instead of a bare verdict (R3, AC5)', () => {
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Mixolydian',
          feedback: ROOT_MATCHED,
        })}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(ROOT_MATCHED.message)
    expect(screen.queryByText(/^not quite\.$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^correct\.$/i)).not.toBeInTheDocument()
  })

  it('drops the hint box, feedback and all, once the day is solved (R9, AC13)', () => {
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          solved: true,
          feedback: SOLVED,
          showNudge: false,
        })}
      />,
    )

    expect(hintQuery()).not.toBeInTheDocument()
    expect(screen.queryByText(SOLVED.message)).not.toBeInTheDocument()
    expect(screen.queryByText(MOVE.message)).not.toBeInTheDocument()
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    expect(nudgeLine()).not.toBeInTheDocument()
  })

  it.each([
    ['solved', { solved: true, feedback: SOLVED }],
    ['revealed', { revealed: true, feedback: ROOT_MATCHED }],
  ])(
    'renders no hint box at all on a %s day, however much it could say',
    (_name, over) => {
      render(
        <GuessCard
          {...props({
            selectedRoot: 'G' as Root,
            selectedFlavour: 'Dorian',
            showNudge: true,
            eliminated: 4,
            ...over,
          })}
        />,
      )

      expect(hintQuery()).not.toBeInTheDocument()
      expect(screen.queryByText('Hint')).not.toBeInTheDocument()
      expect(nudgeLine()).not.toBeInTheDocument()
      expect(screen.queryByRole('status')).not.toBeInTheDocument()
      expect(screen.queryByText(MOVE.message)).toBeNull()
    },
  )

  it('keeps the hint box on a playable day with misses behind it (R8, AC17)', () => {
    render(
      <GuessCard
        {...props({
          showNudge: true,
          eliminated: 2,
          feedback: ROOT_MATCHED,
        })}
      />,
    )

    expect(hintBox()).toHaveTextContent(ROOT_MATCHED.message)
    expect(nudgeLine()).toBeInTheDocument()
  })

  it('is never given the day’s root (R1, AC1)', () => {
    const source = readFileSync(
      resolve(
        process.cwd(),
        'src/features/daily-groove/components/puzzle/GuessCard.tsx',
      ),
      'utf8',
    )

    expect(source).not.toContain('answerRoot')

    const propsBlock = source.match(/type GuessCardProps = \{([\s\S]*?)\n\}/)
    expect(propsBlock).not.toBeNull()
    expect((propsBlock as RegExpMatchArray)[1]).not.toMatch(/answer/i)
  })

  it('shows no nudge sentence until it is asked for (R5, AC8)', () => {
    render(<GuessCard {...props()} />)

    expect(nudgeLine()).not.toBeInTheDocument()
    expect(hintBox()).toContainElement(screen.getByText(OPENING.message))
  })

  it('names the count the app ruled out, below the feedback inside one box (R17, AC17)', () => {
    render(
      <GuessCard
        {...props({
          showNudge: true,
          eliminated: 2,
          feedback: ROOT_MATCHED,
        })}
      />,
    )

    const box = hintBox()
    expect(box).toHaveTextContent(/2 roots ruled out/)
    expect(box).toHaveTextContent(/narrowing/i)
    for (const root of ROOTS) {
      expect(box.textContent ?? '', root).not.toMatch(
        new RegExp(`(^|[^A-Za-z♭♯])${root}([^A-Za-z♭♯]|$)`),
      )
    }
    const status = screen.getByRole('status')
    expect(status).toHaveTextContent(ROOT_MATCHED.message)
    expect(box).toContainElement(status)
    expect(precedes(status, nudgeLine() as HTMLElement)).toBe(true)
  })

  it('renders no nudge sentence when the app has eliminated nothing (R19, AC18)', () => {
    render(<GuessCard {...props({ showNudge: false, eliminated: 0 })} />)

    expect(nudgeLine()).not.toBeInTheDocument()
    expect(hintBox()).toHaveTextContent(OPENING.message)
  })

  it('renders the box with the count it was handed (R17, AC17)', () => {
    render(<GuessCard {...props({ showNudge: true, eliminated: 4 })} />)

    expect(hintBox()).toHaveTextContent(/4 roots ruled out/)
  })

  it('labels the one box "Hint", never "A nudge" (R6, AC9)', () => {
    render(<GuessCard {...props({ showNudge: true, eliminated: 2 })} />)

    expect(screen.getByText('Hint')).toBeInTheDocument()
    expect(screen.queryByText(/a nudge/i)).not.toBeInTheDocument()
    expect(
      screen.queryByRole('complementary', { name: 'A nudge' }),
    ).not.toBeInTheDocument()
  })

  it('keeps the feedback the card\u2019s only live region (R5, R10, AC14)', () => {
    const { container } = render(
      <GuessCard
        {...props({
          showNudge: true,
          eliminated: 2,
          feedback: ROOT_MATCHED,
        })}
      />,
    )

    expect(hintBox()).not.toHaveAttribute('aria-live')
    expect(container.querySelectorAll('[aria-live]')).toHaveLength(1)
    const regions = screen.getAllByRole('status')
    expect(regions).toHaveLength(1)
    expect(regions[0]).toHaveTextContent(ROOT_MATCHED.message)
    expect(regions[0]).toHaveTextContent(MOVE.message)
    expect(regions[0]).toHaveTextContent(/2 roots ruled out/)
  })

  it('leaves every root chip unpressed and enabled when the box appears (AC10, AC11)', () => {
    render(
      <GuessCard
        {...props({
          showNudge: true,
          eliminated: 2,
          ruledOutRoots: [],
          feedback: ROOT_MATCHED,
        })}
      />,
    )

    const chips = within(rootGroup()).getAllByRole('button')
    expect(chips).toHaveLength(12)
    expect(chips.filter((b) => b.getAttribute('aria-pressed') === 'true')).toEqual(
      [],
    )
    for (const chip of chips) expect(chip).toBeEnabled()
    expect(
      chips.filter((b) => b.getAttribute('aria-disabled') === 'true'),
    ).toEqual([])
  })

  it('offers every root as an ordinary, clickable choice while the box shows (R6, AC10)', async () => {
    const user = userEvent.setup()
    const onSelectRoot = vi.fn()
    render(
      <GuessCard
        {...props({
          showNudge: true,
          eliminated: 2,
          ruledOutRoots: [],
          onSelectRoot,
          feedback: ROOT_MATCHED,
        })}
      />,
    )

    await user.click(within(rootGroup()).getByRole('button', { name: 'G' }))
    expect(onSelectRoot).toHaveBeenCalledWith('G')
    expect(
      within(rootGroup())
        .getAllByRole('button')
        .filter((chip) => chip.getAttribute('aria-disabled') === 'true'),
    ).toEqual([])
  })

  it('keeps both chips pressed and disables the control after a wrong check (AC9)', () => {
    const { rerender } = render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Mixolydian',
          canCheck: false,
          feedback: ROOT_MATCHED,
        })}
      />,
    )

    expect(
      within(rootGroup()).getByRole('button', { name: 'G' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      within(flavourGroup()).getByRole('button', { name: 'Mixolydian' }),
    ).toHaveAttribute('aria-pressed', 'true')
    expect(
      screen.getByRole('button', { name: 'Check G Mixolydian' }),
    ).toBeDisabled()

    rerender(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          canCheck: true,
          feedback: ROOT_MATCHED,
        })}
      />,
    )
    expect(screen.getByRole('button', { name: 'Check G Dorian' })).toBeEnabled()
  })

  it('stops accepting chip input once the day is solved (AC10)', async () => {
    const user = userEvent.setup()
    const onSelectRoot = vi.fn()
    const onSelectFlavour = vi.fn()
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          solved: true,
          onSelectRoot,
          onSelectFlavour,
          feedback: SOLVED,
        })}
      />,
    )

    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
    expect(onSelectRoot).not.toHaveBeenCalled()

    await user.click(
      within(flavourGroup()).getByRole('button', { name: 'Lydian' }),
    )
    expect(onSelectFlavour).not.toHaveBeenCalled()

    expect(
      within(rootGroup()).getByRole('button', { name: 'G' }),
    ).toHaveAttribute('aria-pressed', 'true')
  })

  it('gives the control its solved treatment once the day is solved (R12)', () => {
    const { unmount } = render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          canCheck: true,
        })}
      />,
    )
    const readyClass = screen.getByRole('button', {
      name: 'Check G Dorian',
    }).className
    unmount()

    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          solved: true,
          feedback: SOLVED,
        })}
      />,
    )

    const control = screen.getByRole('button', { name: 'Solved' })
    expect(control).toBeDisabled()
    expect(control.className).not.toBe(readyClass)
  })

  const sizeOf = (el: HTMLElement) =>
    (el.className.match(/py-\[\d+px\]|text-\[\d+px\]/g) ?? []).sort()

  it('renders the check control at the play control\u2019s size (R15, R18, AC13)', () => {
    render(
      <>
        <GuessCard
          {...props({
            selectedRoot: 'G' as Root,
            selectedFlavour: 'Dorian',
            canCheck: true,
          })}
        />
        <PlayControl isPlaying={false} onToggle={vi.fn()} />
      </>,
    )

    const check = screen.getByRole('button', { name: 'Check G Dorian' })
    const play = screen.getByRole('button', { name: 'Play the loop' })

    expect(sizeOf(check)).toEqual(sizeOf(play))
    expect(sizeOf(check)).toEqual(['py-[22px]', 'text-[17px]'])
  })

  it('leaves the give-up control at the default size (R18)', () => {
    render(<GuessCard {...props(REVEAL_READY)} />)

    expect(sizeOf(giveUp() as HTMLElement)).toEqual([
      'py-[15px]',
      'text-[15px]',
    ])
  })

  const LONGEST_CHECK_LABELS = (() => {
    const flavours = [...new Set(GROOVES.map((groove) => groove.flavour))]
    const labels = ROOTS.flatMap((root) =>
      flavours.map((flavour) => `Check ${root} ${flavour}`),
    )
    const longest = Math.max(...labels.map((label) => label.length))
    return labels.filter((label) => label.length === longest)
  })()

  const LONGEST_CHECK_LABEL = 'Check E\u266D Phrygian dominant'

  it('has a longest possible label of 26 characters (R16, AC14)', () => {
    for (const label of LONGEST_CHECK_LABELS) {
      expect(label, label).toHaveLength(26)
    }
    expect(LONGEST_CHECK_LABELS).toContain(LONGEST_CHECK_LABEL)
  })

  it('renders the longest label it can show in full, uncut (R16, AC14)', () => {
    const [, root, ...flavour] = LONGEST_CHECK_LABEL.split(' ')
    render(
      <GuessCard
        {...props({
          selectedRoot: root as Root,
          selectedFlavour: flavour.join(' ') as Flavour,
          flavours: [flavour.join(' ') as Flavour],
          canCheck: true,
        })}
      />,
    )

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

  it('keeps the waiting, live and solved states apart at the larger size (R17, AC15)', () => {
    const states: { name: string; token: string; className: string }[] = []

    const capture = (name: string, token: string, override: Partial<Props>) => {
      const { unmount } = render(<GuessCard {...props(override)} />)
      states.push({
        name,
        token,
        className: screen.getByRole('button', { name }).className,
      })
      unmount()
    }

    capture('Pick a root and a mode', 'bg-surface-inset', { canCheck: false })
    capture('Check G Dorian', 'bg-accent', {
      selectedRoot: 'G' as Root,
      selectedFlavour: 'Dorian',
      canCheck: true,
    })
    capture('Solved', 'bg-accent-soft', {
      selectedRoot: 'G' as Root,
      selectedFlavour: 'Dorian',
      solved: true,
      feedback: SOLVED,
    })

    expect(new Set(states.map((state) => state.className)).size).toBe(3)
    for (const state of states) {
      expect(state.className, state.name).toContain(state.token)
      expect(state.className, state.name).toContain('py-[22px]')
    }
  })

  it('lays the twelve roots out on 4 columns, rising to 6 (R2a, R4, AC4)', () => {
    render(<GuessCard {...props()} />)
    const list = chipList(rootGroup())

    expect(list.className).toMatch(/\bgrid\b/)
    expect(list.className).toContain('grid-cols-4')
    expect(list.className).toContain('md:grid-cols-6')
  })

  it('lays the four flavours out on 2 columns, rising to 4 (R2a, R4, AC4)', () => {
    render(<GuessCard {...props()} />)
    const list = chipList(flavourGroup())

    expect(list.className).toMatch(/\bgrid\b/)
    expect(list.className).toContain('grid-cols-2')
    expect(list.className).toContain('md:grid-cols-4')
  })

  it('asks for no chip width on either row (R6, AC7)', () => {
    render(<GuessCard {...props()} />)

    for (const chip of screen.getAllByRole('button')) {
      expect(chip.className).not.toMatch(/\bw-\[/)
    }
  })

  it('lays both rows out through the same component (R4, AC4)', () => {
    render(<GuessCard {...props()} />)
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

  const GIVE_UP = 'Give up and show the answer'
  const CONFIRM = 'Yes — end the day and show the answer'

  const giveUp = () => screen.queryByRole('button', { name: GIVE_UP })
  const confirm = () => screen.queryByRole('button', { name: CONFIRM })

  const REVEAL_READY = {
    selectedRoot: 'G' as Root,
    selectedFlavour: 'Dorian' as Flavour,
    feedback: ROOT_MATCHED,
    showNudge: true,
    showReveal: true,
  }

  it('sounds a chip it declines to select (R4a, AC5a)', async () => {
    const user = userEvent.setup()
    const onSelectRoot = vi.fn()
    const onHearRoot = vi.fn()
    render(
      <GuessCard
        {...props({ ruledOutRoots: ['G'], onSelectRoot, onHearRoot })}
      />,
    )

    await user.click(within(rootGroup()).getByRole('button', { name: 'G' }))

    expect(onHearRoot).toHaveBeenCalledWith('G')
    expect(onSelectRoot).not.toHaveBeenCalled()
  })

  it('dims the roots it is told are ruled out, and leaves the row alone (R4, R5, R6)', async () => {
    const user = userEvent.setup()
    const onSelectRoot = vi.fn()
    const onCheck = vi.fn()
    const out: Root[] = ['G', 'B♭', 'F♯']
    render(
      <GuessCard {...props({ ruledOutRoots: out, onSelectRoot, onCheck })} />,
    )

    const chips = within(rootGroup()).getAllByRole('button')
    expect(chips.map(chipLabel)).toEqual(ROOTS)

    const dimmed = chips.filter(
      (chip) => chip.getAttribute('aria-disabled') === 'true',
    )
    expect(dimmed.map(chipLabel)).toEqual(
      ROOTS.filter((root) => out.includes(root)),
    )
    for (const chip of dimmed) expect(chip, chipLabel(chip)).not.toBeDisabled()

    const live = within(rootGroup()).getByRole('button', { name: 'C' })
    for (const chip of dimmed) {
      expect(chip.className, chipLabel(chip)).not.toBe(live.className)
    }

    await user.click(within(rootGroup()).getByRole('button', { name: 'G' }))
    expect(onSelectRoot).not.toHaveBeenCalled()
    expect(onCheck).not.toHaveBeenCalled()
  })

  it('dims a ruled-out mode in the treatment a ruled-out root wears (R4, R5, AC5)', async () => {
    const user = userEvent.setup()
    const onSelectFlavour = vi.fn()
    const onHearMode = vi.fn()
    render(
      <GuessCard
        {...props({
          ruledOutRoots: ['G'],
          ruledOutFlavours: ['Mixolydian'],
          onSelectFlavour,
          onHearMode,
        })}
      />,
    )

    expect(
      within(flavourGroup()).getAllByRole('button').map(chipLabel),
    ).toEqual(FLAVOURS)

    const chip = within(flavourGroup()).getByRole('button', {
      name: 'Mixolydian',
    })
    expect(chip).toHaveAttribute('aria-disabled', 'true')
    expect(chip).not.toBeDisabled()
    expect(chip.className).toBe(
      within(rootGroup()).getByRole('button', { name: 'G' }).className,
    )
    expect(chip.className).not.toBe(
      within(flavourGroup()).getByRole('button', { name: 'Dorian' }).className,
    )

    await user.click(chip)
    expect(onHearMode).toHaveBeenCalledWith('Mixolydian')
    expect(onSelectFlavour).not.toHaveBeenCalled()
  })

  it('keeps a simple-mode row whole while one of its two options is out (R4, R6)', () => {
    render(
      <GuessCard
        {...props({
          simple: true,
          flavours: FAMILIES,
          ruledOutFlavours: ['Major'],
        })}
      />,
    )

    const chips = within(flavourGroup()).getAllByRole('button')
    expect(chips.map(chipLabel)).toEqual(FAMILIES)
    expect(
      chips
        .filter((chip) => chip.getAttribute('aria-disabled') === 'true')
        .map(chipLabel),
    ).toEqual(['Major'])
  })

  it.each([
    ['solved', { solved: true, feedback: SOLVED }],
    ['revealed', { revealed: true }],
  ])(
    'silences a ruled-out chip once the day is %s (R4b, AC5b)',
    async (_name, over) => {
      const user = userEvent.setup()
      const onHearRoot = vi.fn()
      const onSelectRoot = vi.fn()
      render(
        <GuessCard
          {...props({
            ruledOutRoots: ['G'],
            ruledOutFlavours: ['Mixolydian'],
            onHearRoot,
            onSelectRoot,
            ...over,
          })}
        />,
      )

      const chip = within(rootGroup()).getByRole('button', { name: 'G' })
      expect(chip).toBeDisabled()

      await user.click(chip)
      expect(onHearRoot).not.toHaveBeenCalled()
      expect(onSelectRoot).not.toHaveBeenCalled()

      for (const group of [rootGroup(), flavourGroup()]) {
        for (const other of within(group).getAllByRole('button')) {
          expect(other, chipLabel(other)).toBeDisabled()
        }
      }
    },
  )

  it('keeps the ruled-out chips distinguishable once the day has ended (R20, AC19)', () => {
    render(
      <GuessCard {...props({ revealed: true, ruledOutRoots: ['G', 'B♭'] })} />,
    )

    const chips = within(rootGroup()).getAllByRole('button')
    expect(chips).toHaveLength(12)
    expect(new Set(chips.map((chip) => chip.className)).size).toBe(2)

    const isOut = (chip: Element) => ['G', 'B♭'].includes(chipLabel(chip))
    const ruled = chips.filter(isOut)
    const rest = chips.filter((chip) => !isOut(chip))
    expect(ruled).toHaveLength(2)
    expect(new Set(ruled.map((chip) => chip.className)).size).toBe(1)
    expect(new Set(rest.map((chip) => chip.className)).size).toBe(1)
    expect(ruled[0].className).not.toBe(rest[0].className)

    for (const chip of chips) expect(chip, chipLabel(chip)).toBeDisabled()
  })

  it('offers no way to give up until it is asked for (R6, AC6)', () => {
    render(<GuessCard {...props()} />)

    expect(giveUp()).not.toBeInTheDocument()
    expect(confirm()).not.toBeInTheDocument()
  })

  it('offers to give up once showReveal is set (R6, AC6)', () => {
    render(<GuessCard {...props(REVEAL_READY)} />)

    expect(giveUp()).toBeInTheDocument()
    expect(giveUp()).toBeEnabled()
  })

  it('asks for confirmation on the first press rather than ending the day (R6a, AC8)', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()
    render(<GuessCard {...props({ ...REVEAL_READY, onReveal })} />)

    await user.click(giveUp() as HTMLElement)

    expect(onReveal).not.toHaveBeenCalled()
    expect(giveUp()).not.toBeInTheDocument()
    expect(confirm()).toBeInTheDocument()

    for (const chip of within(rootGroup()).getAllByRole('button')) {
      expect(chip).toBeEnabled()
    }
  })

  it('ends the day on the second press, exactly once (R7, AC8a)', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()
    render(<GuessCard {...props({ ...REVEAL_READY, onReveal })} />)

    await user.click(giveUp() as HTMLElement)
    await user.click(confirm() as HTMLElement)

    expect(onReveal).toHaveBeenCalledTimes(1)
  })

  it('disarms when a root chip is selected instead (R6b, AC8c)', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()
    const onSelectRoot = vi.fn()
    render(
      <GuessCard {...props({ ...REVEAL_READY, onReveal, onSelectRoot })} />,
    )

    await user.click(giveUp() as HTMLElement)
    expect(confirm()).toBeInTheDocument()

    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))

    expect(onSelectRoot).toHaveBeenCalledWith('C')
    expect(onReveal).not.toHaveBeenCalled()
    expect(confirm()).not.toBeInTheDocument()
    expect(giveUp()).toBeInTheDocument()
  })

  it('disarms when a flavour chip is selected instead (R6b, AC8c)', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()
    const onSelectFlavour = vi.fn()
    render(
      <GuessCard {...props({ ...REVEAL_READY, onReveal, onSelectFlavour })} />,
    )

    await user.click(giveUp() as HTMLElement)
    await user.click(
      within(flavourGroup()).getByRole('button', { name: 'Lydian' }),
    )

    expect(onSelectFlavour).toHaveBeenCalledWith('Lydian')
    expect(onReveal).not.toHaveBeenCalled()
    expect(giveUp()).toBeInTheDocument()
  })

  it('disarms when a guess is checked instead, and still scores it (R6b, AC8b)', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()
    const onCheck = vi.fn()
    render(
      <GuessCard
        {...props({ ...REVEAL_READY, canCheck: true, onReveal, onCheck })}
      />,
    )

    await user.click(giveUp() as HTMLElement)
    expect(confirm()).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Check G Dorian' }))

    expect(onCheck).toHaveBeenCalledTimes(1)
    expect(onReveal).not.toHaveBeenCalled()
    expect(confirm()).not.toBeInTheDocument()
    expect(giveUp()).toBeInTheDocument()
  })

  it('goes inert once the day is revealed (R7, AC8a)', async () => {
    const user = userEvent.setup()
    const onSelectRoot = vi.fn()
    const onSelectFlavour = vi.fn()
    const onCheck = vi.fn()
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          feedback: ROOT_MATCHED,
          revealed: true,
          showReveal: false,
          canCheck: false,
          onSelectRoot,
          onSelectFlavour,
          onCheck,
        })}
      />,
    )

    for (const chip of within(rootGroup()).getAllByRole('button')) {
      expect(chip).toBeDisabled()
    }
    for (const chip of within(flavourGroup()).getAllByRole('button')) {
      expect(chip).toBeDisabled()
    }

    const check = screen.getByRole('button', { name: 'Check G Dorian' })
    expect(check).toBeDisabled()

    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))
    await user.click(
      within(flavourGroup()).getByRole('button', { name: 'Lydian' }),
    )
    await user.click(check)
    expect(onSelectRoot).not.toHaveBeenCalled()
    expect(onSelectFlavour).not.toHaveBeenCalled()
    expect(onCheck).not.toHaveBeenCalled()

    expect(giveUp()).not.toBeInTheDocument()
    expect(confirm()).not.toBeInTheDocument()
  })

  it('leaves the check control disabled on a revealed day even if a check would be legal (R7, AC8a)', () => {
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          canCheck: true,
          revealed: true,
        })}
      />,
    )

    expect(screen.getByRole('button', { name: 'Check G Dorian' })).toBeDisabled()
  })

  it('carries a simple-mode switch, under the heading and above both rows (R1, AC1)', () => {
    render(<GuessCard {...props()} />)

    const toggle = modeSwitch()
    expect(precedes(screen.getByRole('heading'), toggle)).toBe(true)
    expect(precedes(toggle, rootGroup())).toBe(true)
    expect(precedes(toggle, flavourGroup())).toBe(true)
  })

  it('reports the mode the player asked for, not the one they left (R1, AC1)', async () => {
    const user = userEvent.setup()
    const onToggleSimple = vi.fn()
    render(<GuessCard {...props({ simple: false, onToggleSimple })} />)

    await user.click(modeSwitch())

    expect(onToggleSimple).toHaveBeenCalledWith(true)
  })

  it('asks to leave simple mode when it is already on (R1, AC1)', async () => {
    const user = userEvent.setup()
    const onToggleSimple = vi.fn()
    render(
      <GuessCard
        {...props({ simple: true, flavours: FAMILIES, onToggleSimple })}
      />,
    )

    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
    await user.click(modeSwitch())
    expect(onToggleSimple).toHaveBeenCalledWith(false)
  })

  it('keeps the switch live on a playable day with misses behind it (F11 E4 R3, AC3)', async () => {
    const user = userEvent.setup()
    const onToggleSimple = vi.fn()
    render(
      <GuessCard
        {...props({
          feedback: ROOT_MATCHED,
          onToggleSimple,
        })}
      />,
    )

    expect(modeSwitch()).toBeEnabled()
    await user.click(modeSwitch())

    expect(onToggleSimple).toHaveBeenCalledWith(true)
  })

  it('settles the switch on a day that is already over (F11 E4 R1, AC1)', async () => {
    const user = userEvent.setup()
    const onToggleSimple = vi.fn()
    render(
      <GuessCard
        {...props({
          solved: true,
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          feedback: SOLVED,
          onToggleSimple,
        })}
      />,
    )

    expect(within(rootGroup()).getAllByRole('button')[0]).toBeDisabled()
    expect(modeSwitch()).toBeDisabled()
    await user.click(modeSwitch())
    expect(onToggleSimple).not.toHaveBeenCalled()
  })

  it('settles the switch on a revealed day too (F11 E4 R2, AC2)', async () => {
    const user = userEvent.setup()
    const onToggleSimple = vi.fn()
    render(<GuessCard {...props({ revealed: true, onToggleSimple })} />)

    expect(modeSwitch()).toBeDisabled()
    await user.click(modeSwitch())
    expect(onToggleSimple).not.toHaveBeenCalled()
  })

  it('keeps a settled switch showing which mode the day was played in (F11 E4 R4, R5, AC4, AC5)', () => {
    render(
      <GuessCard
        {...props({
          simple: true,
          flavours: FAMILIES,
          roots: ['C', 'D', 'E', 'G', 'A', 'B'] as Root[],
          solved: true,
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Minor',
          feedback: SOLVED,
        })}
      />,
    )

    expect(modeSwitch()).toBeInTheDocument()
    expect(modeSwitch()).toHaveAttribute('aria-checked', 'true')
  })

  it('leaves the finished card untouched when its settled switch is clicked (F11 E4 R7, R7a)', async () => {
    const user = userEvent.setup()
    const onToggleSimple = vi.fn()
    render(
      <GuessCard
        {...props({
          solved: true,
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          feedback: SOLVED,
          onToggleSimple,
        })}
      />,
    )

    const before = {
      roots: within(rootGroup()).getAllByRole('button').map(chipLabel),
      flavours: within(flavourGroup()).getAllByRole('button').map(chipLabel),
    }

    await user.click(modeSwitch())

    expect(within(rootGroup()).getAllByRole('button').map(chipLabel)).toEqual(
      before.roots,
    )
    expect(
      within(flavourGroup()).getAllByRole('button').map(chipLabel),
    ).toEqual(before.flavours)
    expect(onToggleSimple).not.toHaveBeenCalled()
  })

  it('disarms an armed give-up when the mode is switched instead (R6b)', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()
    render(<GuessCard {...props({ showReveal: true, onReveal })} />)

    await user.click(
      screen.getByRole('button', { name: 'Give up and show the answer' }),
    )
    await user.click(modeSwitch())

    expect(
      screen.getByRole('button', { name: 'Give up and show the answer' }),
    ).toBeInTheDocument()
    expect(onReveal).not.toHaveBeenCalled()
  })

  for (const simple of [false, true]) {
    const flavours = simple ? FAMILIES : FLAVOURS
    const roots = (simple ? ['C', 'D', 'E', 'G', 'A', 'B'] : ROOTS) as Root[]

    it(`keeps both rows labelled and single-select with simple=${simple} (R11, AC11)`, () => {
      render(
        <GuessCard
          {...props({
            simple,
            roots,
            flavours,
            selectedRoot: 'G' as Root,
            selectedFlavour: flavours[1],
          })}
        />,
      )

      const pressed = (group: HTMLElement) =>
        within(group)
          .getAllByRole('button')
          .filter((b) => b.getAttribute('aria-pressed') === 'true')
          .map(chipLabel)

      expect(pressed(rootGroup())).toEqual(['G'])
      expect(pressed(flavourGroup())).toEqual([flavours[1]])
    })

    it(`keeps the switch and both rows keyboard-reachable with simple=${simple} (R11, AC11)`, async () => {
      const user = userEvent.setup()
      render(<GuessCard {...props({ simple, roots, flavours })} />)

      const visited: Element[] = []
      for (let i = 0; i < 25; i += 1) {
        await user.tab()
        if (document.activeElement) visited.push(document.activeElement)
      }

      const toggle = modeSwitch()
      const sounds = soundSwitch()
      const firstRoot = within(rootGroup()).getAllByRole('button')[0]
      const firstFlavour = within(flavourGroup()).getAllByRole('button')[0]

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

  it('offers exactly the two options it is handed in simple mode (R4, AC3)', () => {
    render(<GuessCard {...props({ simple: true, flavours: FAMILIES })} />)

    expect(
      within(flavourGroup()).getAllByRole('button').map(chipLabel),
    ).toEqual(['Major', 'Minor'])
  })

  it('keeps the second row labelled "Mode" in either mode (R4, AC3)', () => {
    render(<GuessCard {...props({ simple: true, flavours: FAMILIES })} />)

    expect(screen.getByRole('radiogroup', { name: 'Mode' })).toBeInTheDocument()
    expect(screen.queryByRole('radiogroup', { name: 'Family' })).toBeNull()
  })

  it('names no mode anywhere on the card in simple mode (R4, AC3)', () => {
    const { container } = render(
      <GuessCard
        {...props({
          simple: true,
          flavours: FAMILIES,
          roots: ['C', 'D', 'E', 'G', 'A', 'B'] as Root[],
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Minor',
          canCheck: true,
          showNudge: true,
        })}
      />,
    )

    expect(rootGroup().textContent).not.toMatch(MODE_NAME)
    expect(flavourGroup().textContent).not.toMatch(MODE_NAME)
    expect(container.textContent).not.toMatch(MODE_NAME)
  })

  it('never shows the chord or the progression while unsolved (Epic 4 guard)', () => {
    const { container } = render(
      <GuessCard
        {...props({
          selectedRoot: 'C' as Root,
          selectedFlavour: 'Minor',
          canCheck: true,
        })}
      />,
    )

    expect(container.textContent).not.toContain('Cm7')
    expect(container.textContent).not.toContain('Cm–Fm–G7')
  })

  it('reports the root and asks for its note on the same tap (R1, R2, AC1)', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    const onSelectRoot = vi.fn((r: Root) => calls.push(`select:${r}`))
    const onHearRoot = vi.fn((r: Root) => calls.push(`hear:${r}`))
    render(<GuessCard {...props({ onSelectRoot, onHearRoot })} />)

    await user.click(within(rootGroup()).getByRole('button', { name: 'E♭' }))

    expect(onSelectRoot).toHaveBeenCalledWith('E♭')
    expect(onHearRoot).toHaveBeenCalledWith('E♭')
    expect(calls).toEqual(['select:E♭', 'hear:E♭'])
  })

  it('asks again when the root already selected is tapped again (R1, AC2)', async () => {
    const user = userEvent.setup()
    const onHearRoot = vi.fn()
    render(
      <GuessCard
        {...props({ selectedRoot: 'E♭' as Root, onHearRoot })}
      />,
    )

    const chip = within(rootGroup()).getByRole('button', { name: 'E♭' })
    await user.click(chip)
    await user.click(chip)

    expect(onHearRoot).toHaveBeenCalledTimes(2)
    expect(onHearRoot).toHaveBeenNthCalledWith(1, 'E♭')
    expect(onHearRoot).toHaveBeenNthCalledWith(2, 'E♭')
    expect(chip).toHaveAttribute('aria-pressed', 'true')
  })

  it('stays silent once the day is solved (R12, AC10)', async () => {
    const user = userEvent.setup()
    const onHearRoot = vi.fn()
    const onSelectRoot = vi.fn()
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          solved: true,
          feedback: SOLVED,
          onSelectRoot,
          onHearRoot,
        })}
      />,
    )

    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))

    expect(onHearRoot).not.toHaveBeenCalled()
    expect(onSelectRoot).not.toHaveBeenCalled()
  })

  it('stays silent once the day has been revealed (R12, AC10)', async () => {
    const user = userEvent.setup()
    const onHearRoot = vi.fn()
    render(
      <GuessCard
        {...props({ revealed: true, onHearRoot })}
      />,
    )

    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))

    expect(onHearRoot).not.toHaveBeenCalled()
  })

  it('sounds every root a narrowed row offers (R7, AC6)', async () => {
    const user = userEvent.setup()
    const onHearRoot = vi.fn()
    const six: Root[] = ['C', 'E♭', 'F', 'G', 'A', 'B♭']
    render(
      <GuessCard {...props({ roots: six, simple: true, onHearRoot })} />,
    )

    for (const root of six) {
      await user.click(within(rootGroup()).getByRole('button', { name: root }))
    }

    expect(onHearRoot.mock.calls.map(([r]) => r)).toEqual(six)
  })

  it('never asks for a note when a mode chip is tapped (R1)', async () => {
    const user = userEvent.setup()
    const onHearRoot = vi.fn()
    render(<GuessCard {...props({ onHearRoot })} />)

    await user.click(
      within(flavourGroup()).getByRole('button', { name: 'Dorian' }),
    )

    expect(onHearRoot).not.toHaveBeenCalled()
  })

  it('still disarms the give-up control when a root is tapped (F7 E3 R6b)', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()
    render(<GuessCard {...props({ showReveal: true, onReveal })} />)

    await user.click(
      screen.getByRole('button', { name: /give up and show the answer/i }),
    )
    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))

    const give = screen.getByRole('button', {
      name: /give up and show the answer/i,
    })
    await user.click(give)
    expect(onReveal).not.toHaveBeenCalled()
  })

  it('reports the mode and asks for its lick on the same tap (R1, R2, AC1)', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    const onSelectFlavour = vi.fn((f: Flavour) => calls.push(`select:${f}`))
    const onHearMode = vi.fn((f: Flavour) => calls.push(`hear:${f}`))
    render(<GuessCard {...props({ onSelectFlavour, onHearMode })} />)

    await user.click(
      within(flavourGroup()).getByRole('button', { name: 'Lydian' }),
    )

    expect(onSelectFlavour).toHaveBeenCalledTimes(1)
    expect(onSelectFlavour).toHaveBeenCalledWith('Lydian')
    expect(onHearMode).toHaveBeenCalledTimes(1)
    expect(onHearMode).toHaveBeenCalledWith('Lydian')
    expect(calls).toEqual(['select:Lydian', 'hear:Lydian'])
  })

  it('asks again when the mode already selected is tapped again (R1, AC2)', async () => {
    const user = userEvent.setup()
    const onSelectFlavour = vi.fn()
    const onHearMode = vi.fn()
    render(
      <GuessCard
        {...props({ selectedFlavour: 'Dorian', onSelectFlavour, onHearMode })}
      />,
    )

    const chip = within(flavourGroup()).getByRole('button', { name: 'Dorian' })
    await user.click(chip)
    await user.click(chip)

    expect(onHearMode).toHaveBeenCalledTimes(2)
    expect(onHearMode).toHaveBeenNthCalledWith(1, 'Dorian')
    expect(onHearMode).toHaveBeenNthCalledWith(2, 'Dorian')
    expect(onSelectFlavour).toHaveBeenCalledTimes(2)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
  })

  it('leaves the line and the control untouched by mode taps (R3, AC3)', async () => {
    const user = userEvent.setup()
    const onCheck = vi.fn()
    render(
      <GuessCard
        {...props({ selectedRoot: 'G' as Root, onCheck })}
      />,
    )

    const control = () =>
      screen.getByRole('button', { name: /^(Pick a |Check |Solved$)/ })
    const before = {
      line: screen.getByText(OPENING.message).textContent,
      label: control().textContent,
      disabled: (control() as HTMLButtonElement).disabled,
    }

    for (const flavour of ['Dorian', 'Lydian', 'Dorian'] as Flavour[]) {
      await user.click(
        within(flavourGroup()).getByRole('button', { name: flavour }),
      )
    }

    expect(screen.getByText(OPENING.message).textContent).toBe(before.line)
    expect(control().textContent).toBe(before.label)
    expect((control() as HTMLButtonElement).disabled).toBe(before.disabled)
    expect(onCheck).not.toHaveBeenCalled()
  })

  it.each([
    ['solved', { solved: true, feedback: SOLVED }],
    ['revealed', { revealed: true }],
  ])('stays silent on a %s day (R22, AC15)', async (_name, over) => {
    const user = userEvent.setup()
    const onHearMode = vi.fn()
    const onSelectFlavour = vi.fn()
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          onSelectFlavour,
          onHearMode,
          ...over,
        })}
      />,
    )

    await user.click(
      within(flavourGroup()).getByRole('button', { name: 'Lydian' }),
    )

    expect(onHearMode).not.toHaveBeenCalled()
    expect(onSelectFlavour).not.toHaveBeenCalled()
  })

  it('sounds every option a narrowed mode row offers (R15, AC11)', async () => {
    const user = userEvent.setup()
    const onHearMode = vi.fn()
    render(
      <GuessCard {...props({ simple: true, flavours: FAMILIES, onHearMode })} />,
    )

    for (const family of FAMILIES) {
      await user.click(
        within(flavourGroup()).getByRole('button', { name: family }),
      )
    }

    expect(onHearMode.mock.calls.map(([f]) => f)).toEqual(FAMILIES)
  })

  it('still disarms the give-up control when a mode is tapped (F7 E3 R6b)', async () => {
    const user = userEvent.setup()
    const onReveal = vi.fn()
    render(<GuessCard {...props({ showReveal: true, onReveal })} />)

    await user.click(
      screen.getByRole('button', { name: /give up and show the answer/i }),
    )
    await user.click(
      within(flavourGroup()).getByRole('button', { name: 'Dorian' }),
    )

    await user.click(
      screen.getByRole('button', { name: /give up and show the answer/i }),
    )
    expect(onReveal).not.toHaveBeenCalled()
  })

  it('never asks for a lick when a root chip is tapped (R1)', async () => {
    const user = userEvent.setup()
    const onHearMode = vi.fn()
    render(<GuessCard {...props({ onHearMode })} />)

    await user.click(within(rootGroup()).getByRole('button', { name: 'C' }))

    expect(onHearMode).not.toHaveBeenCalled()
  })

  describe('the note glyph on the root row (F10 E2)', () => {
    it('marks every root chip with the glyph (R1, R2, AC1)', () => {
      render(<GuessCard {...props()} />)

      const roots = within(rootGroup()).getAllByRole('button')
      expect(roots).toHaveLength(12)
      for (const chip of roots) {
        expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
        expect(chip.textContent, chipLabel(chip)).toBe(
          `${NOTE_GLYPH}${chipLabel(chip)}`,
        )
      }
    })

    it('leaves a root chip’s accessible name its label alone (R4, AC5)', () => {
      render(<GuessCard {...props()} />)

      for (const root of ROOTS) {
        const chip = within(rootGroup()).getByRole('button', { name: root })
        expect(chip).toHaveAccessibleName(root)
      }
      expect(
        within(rootGroup()).queryByRole('button', { name: /♪/ }),
      ).toBeNull()
    })

    it('gives the marked row and the unmarked row identical chips (R8, AC10)', () => {
      render(<GuessCard {...props()} />)

      const classesOf = (group: HTMLElement) =>
        within(group)
          .getAllByRole('button')
          .map((chip) => chip.className)

      const roots = classesOf(rootGroup())
      const modes = classesOf(flavourGroup())

      expect(new Set([...roots, ...modes]).size).toBe(1)
    })

    it('marks all six root chips in simple mode (R3, AC3)', () => {
      const six: Root[] = ['C', 'D', 'E', 'G', 'A', 'B']
      render(<GuessCard {...props({ simple: true, roots: six, flavours: FAMILIES })} />)

      const chips = within(rootGroup()).getAllByRole('button')
      expect(chips).toHaveLength(6)
      expect(chips.map(chipLabel)).toEqual(six)
      for (const chip of chips) expect(chipAdornment(chip)).toBe(NOTE_GLYPH)
    })

    it.each([
      ['solved', { solved: true }],
      ['revealed', { revealed: true }],
    ])('keeps the glyph on the disabled chips of a %s day (R3, AC4)', (_name, over) => {
      render(<GuessCard {...props({ ...over, selectedRoot: 'G' as Root })} />)

      const chips = within(rootGroup()).getAllByRole('button')
      for (const chip of chips) {
        expect(chip).toBeDisabled()
        expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
      }
      const selected = within(rootGroup()).getByRole('button', { name: 'G' })
      expect(selected).toHaveAttribute('aria-pressed', 'true')
      expect(chipAdornment(selected)).toBe(NOTE_GLYPH)
    })

    it('leaves the two rows built the same way (R8, AC10)', () => {
      render(<GuessCard {...props()} />)

      const rootChip = within(rootGroup()).getAllByRole('button')[0]
      const modeChip = within(flavourGroup()).getAllByRole('button')[0]
      expect(rootChip.className).toBe(modeChip.className)
    })
  })

  describe('the note glyph on the mode row (F16 E1)', () => {
    it('marks every mode chip with the same glyph the roots wear (R23, AC16)', () => {
      render(<GuessCard {...props()} />)

      const modes = within(flavourGroup()).getAllByRole('button')
      expect(modes).toHaveLength(FLAVOURS.length)
      for (const chip of modes) {
        expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
        expect(chip.textContent, chipLabel(chip)).toBe(
          `${NOTE_GLYPH}${chipLabel(chip)}`,
        )
      }

      const rootMarks = within(rootGroup())
        .getAllByRole('button')
        .map(chipAdornment)
      expect(new Set([...rootMarks, ...modes.map(chipAdornment)]).size).toBe(1)
    })

    it('leaves a mode chip’s accessible name its label alone (R24, AC16)', () => {
      render(<GuessCard {...props()} />)

      for (const flavour of FLAVOURS) {
        const chip = within(flavourGroup()).getByRole('button', {
          name: flavour,
        })
        expect(chip).toHaveAccessibleName(flavour)
        expect(
          chip.querySelector('[aria-hidden="true"]')?.textContent,
        ).toBe(NOTE_GLYPH)
      }
      expect(
        within(flavourGroup()).queryByRole('button', { name: /♪/ }),
      ).toBeNull()
    })

    it('marks both options in simple mode (R23, AC16)', () => {
      render(<GuessCard {...props({ simple: true, flavours: FAMILIES })} />)

      const chips = within(flavourGroup()).getAllByRole('button')
      expect(chips.map(chipLabel)).toEqual(FAMILIES)
      for (const chip of chips) {
        expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
        expect(chip).toHaveAccessibleName(chipLabel(chip))
      }
    })

    it.each([
      ['solved', { solved: true }],
      ['revealed', { revealed: true }],
    ])('keeps the glyph on the disabled mode chips of a %s day', (_name, over) => {
      render(
        <GuessCard {...props({ ...over, selectedFlavour: 'Dorian' })} />,
      )

      for (const chip of within(flavourGroup()).getAllByRole('button')) {
        expect(chip).toBeDisabled()
        expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
      }
      const selected = within(flavourGroup()).getByRole('button', {
        name: 'Dorian',
      })
      expect(selected).toHaveAttribute('aria-pressed', 'true')
      expect(chipAdornment(selected)).toBe(NOTE_GLYPH)
    })
  })

  describe('the tap-sounds switch (F16 E2)', () => {
    it('sits directly below the simple-mode toggle, above both rows (R1, AC1)', () => {
      render(<GuessCard {...props()} />)

      expect(precedes(modeSwitch(), soundSwitch())).toBe(true)
      expect(precedes(soundSwitch(), rootGroup())).toBe(true)
      expect(precedes(soundSwitch(), flavourGroup())).toBe(true)
    })

    it('shares its stack with the simple-mode toggle (R1, R14, AC1)', () => {
      render(<GuessCard {...props()} />)

      expect(soundSwitch().parentElement).toBe(modeSwitch().parentElement)
    })

    it('reports the state the player asked for, not the one they left (R1)', async () => {
      const user = userEvent.setup()
      const onToggleTapSounds = vi.fn()
      render(<GuessCard {...props({ tapSounds: true, onToggleTapSounds })} />)

      expect(soundSwitch()).toHaveAttribute('aria-checked', 'true')
      await user.click(soundSwitch())

      expect(onToggleTapSounds).toHaveBeenCalledWith(false)
    })

    it('asks to turn the sounds back on when they are off (R1, R4)', async () => {
      const user = userEvent.setup()
      const onToggleTapSounds = vi.fn()
      render(<GuessCard {...props({ tapSounds: false, onToggleTapSounds })} />)

      expect(soundSwitch()).toHaveAttribute('aria-checked', 'false')
      await user.click(soundSwitch())

      expect(onToggleTapSounds).toHaveBeenCalledWith(true)
    })

    it.each([
      ['solved', { solved: true, feedback: SOLVED }],
      ['revealed', { revealed: true }],
    ])('stays live on a %s day while the mode switch settles (R5a, AC11b)', async (_name, over) => {
      const user = userEvent.setup()
      const onToggleTapSounds = vi.fn()
      render(
        <GuessCard
          {...props({
            selectedRoot: 'G' as Root,
            selectedFlavour: 'Dorian',
            onToggleTapSounds,
            ...over,
          })}
        />,
      )

      expect(modeSwitch()).toBeDisabled()
      expect(soundSwitch()).toBeEnabled()

      await user.click(soundSwitch())
      expect(onToggleTapSounds).toHaveBeenCalledWith(false)
    })

    it('marks both rows while the sounds are on (R12, AC11)', () => {
      render(<GuessCard {...props({ tapSounds: true })} />)

      for (const group of [rootGroup(), flavourGroup()]) {
        for (const chip of within(group).getAllByRole('button')) {
          expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
        }
      }
    })

    it('takes the mark off both rows while the sounds are off (R12, AC11)', () => {
      render(<GuessCard {...props({ tapSounds: false })} />)

      for (const group of [rootGroup(), flavourGroup()]) {
        for (const chip of within(group).getAllByRole('button')) {
          expect(chipAdornment(chip), chipLabel(chip)).toBeNull()
        }
      }
    })

    it('keeps the mark on a ruled-out chip while the sounds are on (R4c, AC5c)', () => {
      render(
        <GuessCard
          {...props({
            tapSounds: true,
            ruledOutRoots: ['G', 'B♭'],
            ruledOutFlavours: ['Mixolydian'],
          })}
        />,
      )

      for (const group of [rootGroup(), flavourGroup()]) {
        for (const chip of within(group).getAllByRole('button')) {
          expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
        }
      }
    })

    it('takes the mark off a ruled-out chip too while the sounds are off (R4c, AC5c)', () => {
      render(
        <GuessCard
          {...props({
            tapSounds: false,
            ruledOutRoots: ['G', 'B♭'],
            ruledOutFlavours: ['Mixolydian'],
          })}
        />,
      )

      for (const group of [rootGroup(), flavourGroup()]) {
        for (const chip of within(group).getAllByRole('button')) {
          expect(chipAdornment(chip), chipLabel(chip)).toBeNull()
        }
      }
    })

    it('leaves both rows offering exactly what they offered (R12, AC11)', () => {
      const { unmount } = render(<GuessCard {...props({ tapSounds: true })} />)
      const marked = {
        roots: within(rootGroup()).getAllByRole('button').map(chipLabel),
        modes: within(flavourGroup()).getAllByRole('button').map(chipLabel),
      }
      unmount()

      render(<GuessCard {...props({ tapSounds: false })} />)

      expect(within(rootGroup()).getAllByRole('button').map(chipLabel)).toEqual(
        marked.roots,
      )
      expect(
        within(flavourGroup()).getAllByRole('button').map(chipLabel),
      ).toEqual(marked.modes)
      for (const root of ROOTS) {
        expect(
          within(rootGroup()).getByRole('button', { name: root }),
        ).toHaveAccessibleName(root)
      }
    })

    it('changes nothing else on the card when it is flipped (R5, AC5)', async () => {
      const user = userEvent.setup()
      const onSelectRoot = vi.fn()
      const onSelectFlavour = vi.fn()
      const onCheck = vi.fn()
      render(
        <GuessCard
          {...props({
            feedback: ROOT_MATCHED,
            selectedRoot: 'G' as Root,
            selectedFlavour: 'Dorian',
            canCheck: true,
            onSelectRoot,
            onSelectFlavour,
            onCheck,
          })}
        />,
      )

      const control = () =>
        screen.getByRole('button', { name: /^(Pick a |Check |Solved$)/ })
      const before = {
        line: screen.getByRole('status').textContent,
        label: control().textContent,
        pressed: screen
          .getAllByRole('button')
          .filter((b) => b.getAttribute('aria-pressed') === 'true')
          .map(chipLabel),
      }

      await user.click(soundSwitch())

      expect(screen.getByRole('status').textContent).toBe(before.line)
      expect(control().textContent).toBe(before.label)
      expect(
        screen
          .getAllByRole('button')
          .filter((b) => b.getAttribute('aria-pressed') === 'true')
          .map(chipLabel),
      ).toEqual(before.pressed)
      expect(onSelectRoot).not.toHaveBeenCalled()
      expect(onSelectFlavour).not.toHaveBeenCalled()
      expect(onCheck).not.toHaveBeenCalled()
    })

    it('disarms an armed give-up when the sounds are switched instead (F7 E3 R6b)', async () => {
      const user = userEvent.setup()
      const onReveal = vi.fn()
      render(<GuessCard {...props({ showReveal: true, onReveal })} />)

      await user.click(giveUp() as HTMLElement)
      expect(confirm()).toBeInTheDocument()

      await user.click(soundSwitch())

      expect(onReveal).not.toHaveBeenCalled()
      expect(confirm()).not.toBeInTheDocument()
      expect(giveUp()).toBeInTheDocument()
    })
  })

  describe('the row locks once a check confirms a half (F17 E2)', () => {
    const dimmedIn = (group: HTMLElement) =>
      within(group)
        .getAllByRole('button')
        .filter((chip) => chip.getAttribute('aria-disabled') === 'true')
        .map(chipLabel)

    it('takes every other root out of the row when the root is confirmed (R1, R7, AC1, AC9)', () => {
      render(<GuessCard {...props({ confirmedRoots: ['G'] })} />)
      const g = within(rootGroup()).getByRole('button', { name: 'G' })

      expect(g).not.toHaveAttribute('aria-disabled')
      expect(dimmedIn(rootGroup())).toEqual(ROOTS.filter((r) => r !== 'G'))
      expect(dimmedIn(flavourGroup())).toEqual([])
      for (const chip of within(rootGroup()).getAllByRole('button')) {
        expect(chip, chipLabel(chip)).toBeEnabled()
      }
    })

    it('takes every other mode out, and the other family in simple mode (R1, R6, AC2, AC8)', () => {
      const { unmount } = render(
        <GuessCard {...props({ confirmedFlavours: ['Dorian'] })} />,
      )

      expect(dimmedIn(flavourGroup())).toEqual(
        FLAVOURS.filter((f) => f !== 'Dorian'),
      )
      expect(dimmedIn(rootGroup())).toEqual([])
      unmount()

      render(
        <GuessCard
          {...props({
            simple: true,
            flavours: FAMILIES,
            confirmedFlavours: ['Minor'],
          })}
        />,
      )

      expect(dimmedIn(flavourGroup())).toEqual(['Major'])
      expect(
        within(flavourGroup()).getByRole('button', { name: 'Minor' }),
      ).not.toHaveAttribute('aria-disabled')
    })

    const liveIn = (group: HTMLElement) =>
      within(group)
        .getAllByRole('button')
        .filter((chip) => chip.getAttribute('aria-disabled') !== 'true')
        .map(chipLabel)

    it('leaves the row unlocked when the confirmed value is not one it offers, in both directions (R6, AC8)', () => {
      const { unmount } = render(
        <GuessCard
          {...props({
            simple: true,
            flavours: FAMILIES,
            confirmedFlavours: ['Aeolian'],
          })}
        />,
      )

      expect(liveIn(flavourGroup())).toEqual(FAMILIES)
      expect(dimmedIn(flavourGroup())).toEqual([])
      unmount()

      render(<GuessCard {...props({ confirmedFlavours: ['Minor'] })} />)

      expect(liveIn(flavourGroup())).toEqual(FLAVOURS)
      expect(dimmedIn(flavourGroup())).toEqual([])
    })

    it('falls back to the ruled-out dimming when no confirmed value is offered (R6, R9c, AC8)', () => {
      const SIX: Root[] = ['C', 'D', 'E', 'F', 'G', 'A']
      render(
        <GuessCard
          {...props({
            simple: true,
            roots: SIX,
            flavours: FAMILIES,
            confirmedRoots: ['B♭'],
            confirmedFlavours: ['Aeolian'],
            ruledOutRoots: ['D', 'E'],
            ruledOutFlavours: ['Dorian'],
          })}
        />,
      )

      expect(dimmedIn(rootGroup())).toEqual(['D', 'E'])
      expect(liveIn(rootGroup())).toEqual(['C', 'F', 'G', 'A'])
      expect(dimmedIn(flavourGroup())).toEqual([])
      expect(liveIn(flavourGroup())).toEqual(FAMILIES)
    })

    it.each([
      [
        'a mode confirmed in full mode, read by the simple row',
        {
          simple: true,
          flavours: FAMILIES,
          confirmedFlavours: ['Aeolian'],
          ruledOutFlavours: ['Major'],
        },
      ],
      [
        'a family confirmed in simple mode, read by the full row',
        {
          confirmedFlavours: ['Minor'],
          ruledOutFlavours: ['Dorian', 'Lydian'],
        },
      ],
      [
        'a root the narrowed row no longer offers',
        {
          simple: true,
          roots: ['C', 'D', 'E', 'F', 'G', 'A'] as Root[],
          flavours: FAMILIES,
          confirmedRoots: ['B♭' as Root],
          ruledOutRoots: ['D' as Root, 'E' as Root],
        },
      ],
      [
        'both halves confirmed and offered, with ruled-out options besides',
        {
          confirmedRoots: ['G' as Root],
          confirmedFlavours: ['Dorian'],
          ruledOutRoots: ['D' as Root, 'E' as Root],
          ruledOutFlavours: ['Lydian'],
        },
      ],
      [
        'a stale confirmed half on one row and a live one on the other',
        {
          confirmedRoots: ['G' as Root],
          confirmedFlavours: ['Minor'],
          ruledOutRoots: ['D' as Root],
          ruledOutFlavours: ['Dorian'],
        },
      ],
      [
        'every option on both rows named as ruled out',
        {
          ruledOutRoots: [...ROOTS],
          ruledOutFlavours: [...FLAVOURS],
          confirmedRoots: ['G' as Root],
          confirmedFlavours: ['Dorian'],
        },
      ],
    ])(
      'always keeps at least one live chip in each row: %s (R6, R9c, AC8)',
      (_name, overrides) => {
        render(<GuessCard {...props(overrides)} />)

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

    it('adds no glyph to any chip, at the longest label either row offers (R1a, R9b, AC3)', () => {
      expect(Math.max(...ROOTS.map((root) => root.length))).toBe(2)
      expect(LONGEST_FLAVOUR).toHaveLength(17)
      const { unmount } = render(
        <GuessCard
          {...props({
            flavours: [LONGEST_FLAVOUR, 'Dorian'],
            confirmedRoots: ['C♯'],
            confirmedFlavours: [LONGEST_FLAVOUR],
            tapSounds: true,
          })}
        />,
      )

      for (const group of [rootGroup(), flavourGroup()]) {
        for (const chip of within(group).getAllByRole('button')) {
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
      unmount()

      render(
        <GuessCard {...props({ confirmedRoots: ['C♯'], tapSounds: false })} />,
      )

      for (const chip of within(rootGroup()).getAllByRole('button')) {
        expect(chip.children, chipLabel(chip)).toHaveLength(0)
        expect(chip.textContent).toBe(chipLabel(chip))
      }
    })

    it('locks nothing until something is confirmed, selection included (R2, AC4)', () => {
      const { unmount } = render(<GuessCard {...props()} />)

      expect(dimmedIn(rootGroup())).toEqual([])
      expect(dimmedIn(flavourGroup())).toEqual([])
      unmount()

      render(
        <GuessCard
          {...props({ selectedRoot: 'G' as Root, selectedFlavour: 'Dorian' })}
        />,
      )

      expect(dimmedIn(rootGroup())).toEqual([])
      expect(dimmedIn(flavourGroup())).toEqual([])
    })

    it('keeps the confirmed chip live, selected and selectable (R4, R7, AC6, AC9)', async () => {
      const user = userEvent.setup()
      const onSelectRoot = vi.fn()
      const onHearRoot = vi.fn()
      render(
        <GuessCard
          {...props({
            confirmedRoots: ['G'],
            selectedRoot: 'G' as Root,
            onSelectRoot,
            onHearRoot,
          })}
        />,
      )
      const g = within(rootGroup()).getByRole('button', { name: 'G' })

      expect(g).toHaveAttribute('aria-pressed', 'true')
      expect(g).not.toHaveAttribute('aria-disabled')

      await user.click(g)

      expect(onSelectRoot).toHaveBeenCalledTimes(1)
      expect(onSelectRoot).toHaveBeenCalledWith('G')
      expect(onHearRoot).toHaveBeenCalledTimes(1)
      expect(onHearRoot).toHaveBeenCalledWith('G')
    })

    it('still sounds a locked-out chip, and refuses the pick (R9, AC10a)', async () => {
      const user = userEvent.setup()
      const onSelectRoot = vi.fn()
      const onHearRoot = vi.fn()
      render(
        <GuessCard
          {...props({ confirmedRoots: ['G'], onSelectRoot, onHearRoot })}
        />,
      )
      const out = within(rootGroup()).getByRole('button', { name: 'B♭' })

      expect(out).toHaveAttribute('aria-disabled', 'true')

      await user.click(out)

      expect(onSelectRoot).not.toHaveBeenCalled()
      expect(onHearRoot).toHaveBeenCalledTimes(1)
      expect(onHearRoot).toHaveBeenCalledWith('B♭')
    })

    it('keeps the ♪ on every chip in a locked row, and drops it row-wide (R9a, AC10b)', () => {
      const { unmount } = render(
        <GuessCard
          {...props({
            confirmedRoots: ['G'],
            confirmedFlavours: ['Dorian'],
            tapSounds: true,
          })}
        />,
      )

      for (const group of [rootGroup(), flavourGroup()]) {
        for (const chip of within(group).getAllByRole('button')) {
          expect(chipAdornment(chip), chipLabel(chip)).toBe(NOTE_GLYPH)
        }
      }
      expect(dimmedIn(rootGroup())).toHaveLength(11)
      unmount()

      render(
        <GuessCard
          {...props({
            confirmedRoots: ['G'],
            confirmedFlavours: ['Dorian'],
            tapSounds: false,
          })}
        />,
      )

      for (const group of [rootGroup(), flavourGroup()]) {
        for (const chip of within(group).getAllByRole('button')) {
          expect(chipAdornment(chip), chipLabel(chip)).toBeNull()
        }
      }
    })

    it.each([{ solved: true }, { revealed: true }])(
      'still reads as locked under the day’s own lock (%o) (R8, AC10)',
      (terminal) => {
        render(<GuessCard {...props({ confirmedRoots: ['G'], ...terminal })} />)
        const g = within(rootGroup()).getByRole('button', { name: 'G' })

        expect(dimmedIn(rootGroup())).toEqual(ROOTS.filter((r) => r !== 'G'))
        expect(g).not.toHaveAttribute('aria-disabled')
        expect(g).toBeDisabled()
        expect(g).toHaveAccessibleName('G')
        for (const chip of within(rootGroup()).getAllByRole('button')) {
          expect(chip, chipLabel(chip)).toBeDisabled()
        }
      },
    )

    it('moves nothing on the card when a row locks (R9b, AC10c)', () => {
      const GEOMETRY =
        /^(w-|h-|min-|max-|p[xytblrse]?-|-?m[xytblrse]?-|grid|col-|row-|gap-|flex|absolute|relative|fixed|sticky|-?translate|text-\[|leading-|border-\[|border-[0-9])/
      const chips = () =>
        [rootGroup(), flavourGroup()].flatMap((group) =>
          within(group)
            .getAllByRole('button')
            .map((chip) => chip.className),
        )
      const rows = () =>
        [rootGroup(), flavourGroup()].map((group) => chipList(group).className)

      const { unmount } = render(<GuessCard {...props()} />)
      const before = { chips: chips(), rows: rows() }
      unmount()

      render(
        <GuessCard
          {...props({
            confirmedRoots: ['G'],
            confirmedFlavours: ['Dorian'],
          })}
        />,
      )
      const after = { chips: chips(), rows: rows() }

      expect(after.rows).toEqual(before.rows)
      expect(after.chips).toHaveLength(before.chips.length)
      after.chips.forEach((className, index) => {
        const was = before.chips[index].split(/\s+/).filter(Boolean)
        const now = className.split(/\s+/).filter(Boolean)
        expect(was.filter((name) => !now.includes(name))).toEqual([])
        expect(
          now.filter((name) => !was.includes(name)).filter((name) => GEOMETRY.test(name)),
          'locking a row may not add a class that changes a chip’s box',
        ).toEqual([])
      })
    })
  })
})

describe('through the composed page', () => {
  it("offers today's deterministic flavour options", async () => {
    await renderFeature();

    const today = new Date();
    const groove = selectGrooveForDate(today, GROOVES);
    const expected = flavourOptions(today, groove);
    const flavours = screen.getByRole("radiogroup", { name: "Mode" });

    expect(
      within(flavours).getAllByRole("button").map(chipLabel),
    ).toEqual(expected);
  })

  it("offers all twelve roots, in the design's order", async () => {
    await renderFeature();

    const roots = screen.getByRole("radiogroup", { name: "Root" });
    expect(within(roots).getAllByRole("button").map(chipLabel)).toEqual(ROOTS);
  })

  it("names the chosen pair on the check control once both are picked (AC6)", async () => {
    const user = userEvent.setup();
    await renderFeature();

    const control = () =>
      screen.getByRole("button", { name: /^(Pick a |Check |Solved$)/ });

    expect(control()).toHaveAccessibleName("Pick a root and a mode");
    expect(control()).toBeDisabled();

    const roots = screen.getByRole("radiogroup", { name: "Root" });
    const flavours = screen.getByRole("radiogroup", { name: "Mode" });
    await user.click(within(roots).getByRole("button", { name: "G" }));
    const firstFlavour = within(flavours).getAllByRole("button")[0];
    await user.click(firstFlavour);

    expect(control()).toHaveAccessibleName(
      `Check G ${chipLabel(firstFlavour)}`,
    );
    expect(control()).toBeEnabled();
  })
})
