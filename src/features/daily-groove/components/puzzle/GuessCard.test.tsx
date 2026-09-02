import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { Flavour, Root } from '../../types'
import { ROOTS, flavourOptions } from '../../lib/theory/music'
import { GROOVES } from '../../data/grooves.generated'
import { selectGrooveForDate } from '../../lib/puzzle/selectGroove'
import { renderFeature } from '../../testing/renderFeature'
import type { DotState, Feedback } from '../../lib/presentation/feedback'
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

const UNSPENT: DotState[] = ['unspent', 'unspent', 'unspent']

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
    showNudge: false,
    dots: UNSPENT,
    answerRoot: 'G',
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
const modeSwitch = () => screen.getByRole('switch', { name: /simple mode/i })
const soundSwitch = () => screen.getByRole('switch', { name: /tap sounds/i })
const precedes = (a: Element, b: Element) =>
  Boolean(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
const MODE_NAME = /ionian|dorian|phrygian|lydian|mixolydian|aeolian|locrian/i
const FAMILIES: Flavour[] = ['Major', 'Minor']
const dotStates = () =>
  Array.from(document.querySelectorAll('[data-dot-state]')).map((el) =>
    el.getAttribute('data-dot-state'),
  )

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
    expect(
      screen.getByRole('button', { name: 'Pick a root and a mode' }),
    ).toBeDisabled()
  })

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

  it('renders the attempt dots it is given (R1, AC1)', () => {
    render(<GuessCard {...props()} />)

    expect(screen.getByRole('img')).toHaveAccessibleName(
      expect.stringContaining('0 of 3 attempts spent'),
    )
    expect(dotStates()).toEqual(UNSPENT)
  })

  it('renders exactly the dot states it is handed (R2, AC2, AC3)', () => {
    render(<GuessCard {...props({ dots: ['spent', 'spent', 'unspent'] })} />)
    expect(dotStates()).toEqual(['spent', 'spent', 'unspent'])
  })

  it('shows the feedback it is given in a live region (R3, R4, AC4, AC14)', () => {
    render(<GuessCard {...props()} />)

    const line = screen.getByRole('status')
    expect(line).toHaveTextContent(OPENING.message)
    expect(line).toHaveAttribute('aria-live', 'polite')
  })

  it('shows targeted feedback after a wrong guess instead of a bare verdict (R3, AC5)', () => {
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Mixolydian',
          dots: ['spent', 'unspent', 'unspent'],
          feedback: ROOT_MATCHED,
        })}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(ROOT_MATCHED.message)
    expect(screen.queryByText(/^not quite\.$/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/^correct\.$/i)).not.toBeInTheDocument()
  })

  it('shows the solved wording once the day is solved (R9, AC13)', () => {
    render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Dorian',
          solved: true,
          dots: ['solved', 'solved', 'solved'],
          feedback: SOLVED,
          showNudge: false,
        })}
      />,
    )

    expect(screen.getByRole('status')).toHaveTextContent(SOLVED.message)
    expect(dotStates()).toEqual(['solved', 'solved', 'solved'])
    expect(
      screen.queryByRole('complementary', { name: 'A nudge' }),
    ).not.toBeInTheDocument()
  })

  it('shows no nudge until it is asked for (R5, AC8)', () => {
    render(<GuessCard {...props({ dots: ['spent', 'unspent', 'unspent'] })} />)
    expect(
      screen.queryByRole('complementary', { name: 'A nudge' }),
    ).not.toBeInTheDocument()
  })

  it('names the day’s root in the nudge, alongside the feedback line (R5, R6, AC9)', () => {
    render(
      <GuessCard
        {...props({
          showNudge: true,
          answerRoot: 'G',
          dots: ['spent', 'spent', 'unspent'],
          feedback: ROOT_MATCHED,
        })}
      />,
    )

    const nudge = screen.getByRole('complementary', { name: 'A nudge' })
    expect(nudge.textContent).toMatch(/root is G\./)
    expect(screen.getByRole('status')).toHaveTextContent(ROOT_MATCHED.message)
  })

  it('leaves every root chip unpressed and enabled when the nudge appears (AC10, AC11)', () => {
    render(
      <GuessCard
        {...props({
          showNudge: true,
          answerRoot: 'G',
          dots: ['spent', 'spent', 'unspent'],
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

  it('offers the revealed root as an ordinary, clickable choice (R6, AC10)', async () => {
    const user = userEvent.setup()
    const onSelectRoot = vi.fn()
    render(
      <GuessCard
        {...props({
          showNudge: true,
          answerRoot: 'G',
          onSelectRoot,
          dots: ['spent', 'spent', 'unspent'],
          feedback: ROOT_MATCHED,
        })}
      />,
    )

    await user.click(within(rootGroup()).getByRole('button', { name: 'G' }))
    expect(onSelectRoot).toHaveBeenCalledWith('G')
  })

  it('keeps both chips pressed and disables the control after a wrong check (AC9)', () => {
    const { rerender } = render(
      <GuessCard
        {...props({
          selectedRoot: 'G' as Root,
          selectedFlavour: 'Mixolydian',
          canCheck: false,
          dots: ['spent', 'unspent', 'unspent'],
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
          dots: ['spent', 'unspent', 'unspent'],
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
          dots: ['solved', 'solved', 'solved'],
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
          dots: ['solved', 'solved', 'solved'],
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
      dots: ['solved', 'solved', 'solved'],
      feedback: SOLVED,
    })

    expect(new Set(states.map((state) => state.className)).size).toBe(3)
    for (const state of states) {
      expect(state.className, state.name).toContain(state.token)
      expect(state.className, state.name).toContain('py-[22px]')
    }
  })

  it('puts the attempt dots directly above the check button, not beside the heading (R7, AC7)', () => {
    render(<GuessCard {...props()} />)

    const control = screen.getByRole('button', {
      name: 'Pick a root and a mode',
    })
    const dotsRow = control.previousElementSibling as HTMLElement

    expect(dotsRow.querySelectorAll('[data-dot-state]')).toHaveLength(3)
    expect(within(dotsRow).getByRole('img')).toHaveAccessibleName(
      expect.stringContaining('0 of 3 attempts spent'),
    )

    expect(
      flavourGroup().compareDocumentPosition(dotsRow) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy()
    expect(
      screen.getByRole('heading', { level: 3, name: 'What is it?' })
        .nextElementSibling,
    ).not.toBe(dotsRow)
  })

  it('REGRESSION GUARD: the dot row carries no counter text or label (R7a, AC7)', () => {
    render(<GuessCard {...props({ dots: ['spent', 'spent', 'unspent'] })} />)

    const dotsRow = screen.getByRole('button', {
      name: 'Pick a root and a mode',
    }).previousElementSibling as HTMLElement

    expect(dotsRow.textContent).toBe('')
  })

  it('REGRESSION GUARD: the moved dots keep their accessible name (R8, AC8)', () => {
    render(<GuessCard {...props({ dots: ['spent', 'spent', 'unspent'] })} />)

    expect(
      screen.getByRole('img', { name: /2 of 3 attempts spent/ }),
    ).toBeInTheDocument()
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
    dots: ['spent', 'spent', 'spent'] as DotState[],
    feedback: ROOT_MATCHED,
    showNudge: true,
    showReveal: true,
  }

  it('offers no way to give up until it is asked for (R6, AC6)', () => {
    render(<GuessCard {...props({ dots: ['spent', 'spent', 'unspent'] })} />)

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
          dots: ['spent', 'spent', 'spent'],
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

  it('keeps the switch live on a playable day with attempts spent (F11 E4 R3, AC3)', async () => {
    const user = userEvent.setup()
    const onToggleSimple = vi.fn()
    render(
      <GuessCard
        {...props({
          dots: ['spent', 'spent', 'unspent'],
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
          dots: ['spent', 'spent', 'unspent'],
          onToggleSimple,
        })}
      />,
    )

    const before = {
      roots: within(rootGroup()).getAllByRole('button').map(chipLabel),
      flavours: within(flavourGroup()).getAllByRole('button').map(chipLabel),
      dots: dotStates(),
    }

    await user.click(modeSwitch())

    expect(within(rootGroup()).getAllByRole('button').map(chipLabel)).toEqual(
      before.roots,
    )
    expect(
      within(flavourGroup()).getAllByRole('button').map(chipLabel),
    ).toEqual(before.flavours)
    expect(dotStates()).toEqual(before.dots)
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
          dots: ['solved', 'solved', 'solved'],
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

  it('leaves the dots, the line and the control untouched by mode taps (R3, AC3)', async () => {
    const user = userEvent.setup()
    const onCheck = vi.fn()
    render(
      <GuessCard
        {...props({ selectedRoot: 'G' as Root, onCheck })}
      />,
    )

    const control = () =>
      screen.getByRole('button', { name: /^(Pick a root|Check |Solved$)/ })
    const before = {
      dots: dotStates(),
      line: screen.getByText(OPENING.message).textContent,
      label: control().textContent,
      disabled: (control() as HTMLButtonElement).disabled,
    }

    for (const flavour of ['Dorian', 'Lydian', 'Dorian'] as Flavour[]) {
      await user.click(
        within(flavourGroup()).getByRole('button', { name: flavour }),
      )
    }

    expect(dotStates()).toEqual(before.dots)
    expect(screen.getByText(OPENING.message).textContent).toBe(before.line)
    expect(control().textContent).toBe(before.label)
    expect((control() as HTMLButtonElement).disabled).toBe(before.disabled)
    expect(onCheck).not.toHaveBeenCalled()
  })

  it.each([
    ['solved', { solved: true, dots: ['solved', 'solved', 'solved'] as DotState[], feedback: SOLVED }],
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
      ['solved', { solved: true, dots: ['solved', 'solved', 'solved'] as DotState[], feedback: SOLVED }],
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
            dots: ['spent', 'unspent', 'unspent'],
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
        screen.getByRole('button', { name: /^(Pick a root|Check |Solved$)/ })
      const before = {
        dots: dotStates(),
        line: screen.getByRole('status').textContent,
        label: control().textContent,
        pressed: screen
          .getAllByRole('button')
          .filter((b) => b.getAttribute('aria-pressed') === 'true')
          .map(chipLabel),
      }

      await user.click(soundSwitch())

      expect(dotStates()).toEqual(before.dots)
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
      screen.getByRole("button", { name: /^(Pick a root|Check |Solved$)/ });

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
