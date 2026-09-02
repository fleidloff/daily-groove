import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChipGroup } from './ChipGroup'
import type { ChipColumns } from './ChipGroup'

const OPTIONS = ['One', 'Two', 'Three']

const TWELVE = [
  'One', 'Two', 'Three', 'Four', 'Five', 'Six',
  'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
]
const FOUR = ['Alpha', 'Beta', 'Gamma', 'a considerably longer label']

const NOTE = '♪'

function renderGroup(overrides: Partial<Parameters<typeof ChipGroup>[0]> = {}) {
  const props = {
    label: 'Group',
    options: OPTIONS,
    value: null as string | null,
    onSelect: () => {},
    disabled: false,
    name: 'group',
    columns: { base: 4, wide: 6 } as ChipColumns,
    ...overrides,
  }
  return render(<ChipGroup {...props} />)
}

function chipList(label = 'Group'): HTMLElement {
  const group = screen.getByRole('radiogroup', { name: label })
  const list = group.querySelector('[data-testid="chip-list"]')
  expect(list).not.toBeNull()
  return list as HTMLElement
}

describe('ChipGroup', () => {
  it('exposes a radiogroup named by its label', () => {
    renderGroup({ label: 'Colour' })
    expect(screen.getByRole('radiogroup', { name: 'Colour' })).toBeInTheDocument()
  })

  it('renders the label so a sighted player sees it too', () => {
    renderGroup({ label: 'Colour' })
    expect(screen.getByText('Colour')).toBeInTheDocument()
  })

  it('renders one chip per option', () => {
    renderGroup()
    const group = screen.getByRole('radiogroup', { name: 'Group' })
    expect(within(group).getAllByRole('button')).toHaveLength(OPTIONS.length)
    for (const option of OPTIONS) {
      expect(within(group).getByRole('button', { name: option })).toBeInTheDocument()
    }
  })

  it('marks only the current value as pressed', () => {
    renderGroup({ value: 'Two' })
    expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Two' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Three' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('reports the chosen option', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderGroup({ onSelect })

    await user.click(screen.getByRole('button', { name: 'Three' }))

    expect(onSelect).toHaveBeenCalledWith('Three')
  })

  it('replaces the selection rather than accumulating it', () => {
    const { rerender } = renderGroup({ value: 'One' })
    expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('aria-pressed', 'true')

    rerender(
      <ChipGroup
        label="Group"
        options={OPTIONS}
        value="Three"
        onSelect={() => {}}
        disabled={false}
        name="group"
        columns={{ base: 4, wide: 6 }}
      />,
    )

    expect(screen.getByRole('button', { name: 'One' })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Three' })).toHaveAttribute('aria-pressed', 'true')
  })

  it('is reachable and selectable by keyboard alone', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderGroup({ onSelect })

    await user.tab()
    expect(screen.getByRole('button', { name: 'One' })).toHaveFocus()

    await user.keyboard('{Enter}')
    expect(onSelect).toHaveBeenCalledWith('One')

    await user.tab()
    expect(screen.getByRole('button', { name: 'Two' })).toHaveFocus()

    await user.keyboard(' ')
    expect(onSelect).toHaveBeenLastCalledWith('Two')
  })

  it('forwards disabled to every chip', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    renderGroup({ onSelect, disabled: true })

    for (const option of OPTIONS) {
      expect(screen.getByRole('button', { name: option })).toBeDisabled()
    }
    await user.click(screen.getByRole('button', { name: 'One' }))
    expect(onSelect).not.toHaveBeenCalled()
  })

  it('passes no width to its chips (R6, AC7)', () => {
    const { container } = renderGroup({ options: TWELVE })
    const chips = [...container.querySelectorAll('button')] as HTMLElement[]

    expect(chips).toHaveLength(TWELVE.length)
    for (const chip of chips) expect(chip.className).not.toMatch(/\bw-\[/)
  })

  it('declares no width prop (R6, AC7)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/controls/ChipGroup.tsx'),
      'utf8',
    )

    expect(source).not.toContain('ChipWidth')
    expect(source).not.toMatch(/^\s*width\??:/m)
  })

  it('lays its chips out on a grid at the base column count (R1, R3, AC1)', () => {
    renderGroup({ options: TWELVE, columns: { base: 4, wide: 6 } })
    const list = chipList()

    expect(list.className).toMatch(/\bgrid\b/)
    expect(list.className).toContain('grid-cols-4')
    expect(list.className).not.toContain('flex-wrap')
  })

  it('lets each chip fill its cell rather than hug its label (R3, AC1)', () => {
    const { container } = renderGroup({ options: TWELVE })

    for (const chip of [...container.querySelectorAll('button')]) {
      expect(chip.className).not.toMatch(/\bw-\[/)
      expect(chip.className).not.toMatch(/\bmax-w-/)
    }
  })

  it('never makes its own row wider than its container (R8)', () => {
    renderGroup({ options: TWELVE })
    const list = chipList()

    expect(list.className).not.toMatch(/\bw-\[/)
    expect(list.className).not.toMatch(/\bmin-w-/)
    expect(list.className).not.toMatch(/overflow-x/)
  })

  it('gives a twelve-option group 4 columns, rising to 6 (R2a, AC2)', () => {
    renderGroup({ options: TWELVE, columns: { base: 4, wide: 6 } })
    const list = chipList()

    expect(list.className).toContain('grid-cols-4')
    expect(list.className).toContain('md:grid-cols-6')
  })

  it('gives a four-option group 2 columns, rising to 4 (R2a, AC3)', () => {
    renderGroup({ options: FOUR, columns: { base: 2, wide: 4 } })
    const list = chipList()

    expect(list.className).toContain('grid-cols-2')
    expect(list.className).toContain('md:grid-cols-4')
  })

  it.each([
    { options: 12, columns: { base: 4, wide: 6 } as ChipColumns },
    { options: 4, columns: { base: 2, wide: 4 } as ChipColumns },
  ])(
    'divides $options options evenly at both column counts (R2, R2a)',
    ({ options, columns }) => {
      expect(options % columns.base).toBe(0)
      expect(options % columns.wide).toBe(0)
    },
  )

  it('renders its chips in the order it was given (R7, AC8)', () => {
    renderGroup({ options: TWELVE, columns: { base: 4, wide: 6 } })

    const labels = [...chipList().querySelectorAll('button')].map(
      (chip) => chip.textContent,
    )
    expect(labels).toEqual(TWELVE)
  })

  it('renders each chip as its bare label with no adornment (R7, AC8)', () => {
    renderGroup({ options: FOUR, columns: { base: 2, wide: 4 } })
    const chips = [...chipList().querySelectorAll('button')]

    expect(chips.map((chip) => chip.textContent)).toEqual(FOUR)
    for (const chip of chips) expect(chip.children).toHaveLength(0)
  })

  it('gives every chip the same adornment (R1, R3)', () => {
    renderGroup({
      options: FOUR,
      columns: { base: 2, wide: 4 },
      adornment: NOTE,
    })
    const chips = [...chipList().querySelectorAll('button')]

    expect(chips).toHaveLength(FOUR.length)
    expect(chips.map((chip) => chip.textContent)).toEqual(
      FOUR.map((option) => `${NOTE}${option}`),
    )
  })

  it('leaves every accessible name bare when adorned (R4, AC5)', () => {
    renderGroup({
      options: FOUR,
      columns: { base: 2, wide: 4 },
      adornment: NOTE,
    })

    for (const option of FOUR) {
      expect(screen.getByRole('button', { name: option })).toBeInTheDocument()
    }
  })

  it('keeps the adornment out of the row\u2019s own layout (R8)', () => {
    const plain = renderGroup({ options: FOUR, columns: { base: 2, wide: 4 } })
    const plainClass = (
      plain.container.querySelector('[data-testid="chip-list"]') as HTMLElement
    ).className
    cleanup()

    const adorned = renderGroup({
      options: FOUR,
      columns: { base: 2, wide: 4 },
      adornment: NOTE,
    })
    const adornedClass = (
      adorned.container.querySelector('[data-testid="chip-list"]') as HTMLElement
    ).className

    expect(adornedClass).toBe(plainClass)
  })

  it('gives per-option state to the options it names (R4, R5, R6, AC4, AC6, AC7)', () => {
    const stated = renderGroup({
      options: TWELVE,
      columns: { base: 4, wide: 6 },
      optionStates: { Two: { unavailable: true }, Five: { unavailable: true } },
    })
    const list = stated.container.querySelector(
      '[data-testid="chip-list"]',
    ) as HTMLElement
    const chips = [...list.querySelectorAll('button')]

    expect(chips.map((chip) => chip.textContent)).toEqual(TWELVE)
    for (const chip of chips) {
      if (chip.textContent === 'Two' || chip.textContent === 'Five') {
        expect(chip).toHaveAttribute('aria-disabled', 'true')
        expect(chip).not.toBeDisabled()
      } else {
        expect(chip).not.toHaveAttribute('aria-disabled')
      }
    }
    expect(
      chips.filter((chip) => chip.hasAttribute('aria-disabled')).map(
        (chip) => chip.textContent,
      ),
    ).toEqual(['Two', 'Five'])

    const statedLayout = list.className
    cleanup()

    const plain = renderGroup({ options: TWELVE, columns: { base: 4, wide: 6 } })
    const plainLayout = (
      plain.container.querySelector('[data-testid="chip-list"]') as HTMLElement
    ).className
    expect(statedLayout).toBe(plainLayout)
  })

  it('reports the press of an unavailable option without reporting a choice (R4a, AC5a)', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onPress = vi.fn()
    renderGroup({
      onSelect,
      onPress,
      optionStates: { Two: { unavailable: true } },
    })

    await user.click(screen.getByRole('button', { name: 'Two' }))
    expect(onPress).toHaveBeenCalledWith('Two')
    expect(onSelect).not.toHaveBeenCalled()

    await user.click(screen.getByRole('button', { name: 'Three' }))
    expect(onSelect).toHaveBeenCalledWith('Three')
    expect(onPress).toHaveBeenLastCalledWith('Three')
  })

  it('reports neither a choice nor a press while the row is locked (R4b, AC5b)', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const onPress = vi.fn()
    renderGroup({
      onSelect,
      onPress,
      disabled: true,
      optionStates: { Two: { unavailable: true } },
    })

    await user.click(screen.getByRole('button', { name: 'Two' }))
    await user.click(screen.getByRole('button', { name: 'Three' }))

    expect(onSelect).not.toHaveBeenCalled()
    expect(onPress).not.toHaveBeenCalled()
  })

  it('cannot express the row’s own lock per option (R4b)', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src/components/controls/ChipGroup.tsx'),
      'utf8',
    )
    const block = source.match(/export type ChipOptionState = \{([\s\S]*?)\n\}/)
    expect(block).not.toBeNull()
    const fields = [
      ...(block as RegExpMatchArray)[1].matchAll(/^\s{2}(\w+)\??:/gm),
    ].map((match) => match[1])

    expect(fields).toContain('unavailable')

    const ROW_LOCK = /disabled|silen|inert|locked|frozen|readonly|unclickable/i
    expect(
      fields.filter((field) => ROW_LOCK.test(field)),
      'a per-option field that silences a chip would collapse the two locks: the row owns `disabled`, an option owns `unavailable`',
    ).toEqual([])
  })

  it('keeps an unavailable option out of every other chip’s box, and the row’s (F17 E2 R9b, AC10c)', () => {
    const plain = renderGroup({ options: FOUR, columns: { base: 2, wide: 4 } })
    const before = [...plain.container.querySelectorAll('button')].map(
      (chip) => chip.className,
    )
    const listBefore = (
      plain.container.querySelector('[data-testid="chip-list"]') as HTMLElement
    ).className
    cleanup()

    const stated = renderGroup({
      options: FOUR,
      columns: { base: 2, wide: 4 },
      optionStates: { Beta: { unavailable: true } },
    })
    const after = [...stated.container.querySelectorAll('button')].map(
      (chip) => chip.className,
    )
    const listAfter = (
      stated.container.querySelector('[data-testid="chip-list"]') as HTMLElement
    ).className

    expect(after.filter((_, index) => index !== 1)).toEqual(
      before.filter((_, index) => index !== 1),
    )
    expect(after[1]).not.toBe(before[1])
    expect(listAfter).toBe(listBefore)
  })

  it('ignores a state for an option it does not offer (F17 E2 R9b)', () => {
    renderGroup({
      options: FOUR,
      columns: { base: 2, wide: 4 },
      optionStates: { Zeta: { unavailable: true } },
    })
    const chips = [...chipList().querySelectorAll('button')]

    expect(chips.some((chip) => chip.hasAttribute('aria-disabled'))).toBe(false)
    expect(chips.map((chip) => chip.textContent)).toEqual(FOUR)
  })
})
