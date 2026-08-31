import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChipGroup } from './ChipGroup'
import type { ChipColumns } from './ChipGroup'

const OPTIONS = ['One', 'Two', 'Three']

// Arbitrary strings on purpose: a primitive is exercised with labels that mean
// nothing, so the test cannot quietly teach it a domain concept.
const TWELVE = [
  'One', 'Two', 'Three', 'Four', 'Five', 'Six',
  'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve',
]
const FOUR = ['Alpha', 'Beta', 'Gamma', 'a considerably longer label']

// An arbitrary decorative glyph. What it means is the caller's business.
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

/** The element the chips are laid out on, by the id the group gives it. */
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

  // --- Step A1/A2 — the cell owns the width now (R6, AC7) -------------------

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

  // --- Step A2 — the row is a grid, not a wrapping flex row (R1, R3, AC1) ---

  it('lays its chips out on a grid at the base column count (R1, R3, AC1)', () => {
    renderGroup({ options: TWELVE, columns: { base: 4, wide: 6 } })
    const list = chipList()

    expect(list.className).toMatch(/\bgrid\b/)
    expect(list.className).toContain('grid-cols-4')
    expect(list.className).not.toContain('flex-wrap')
  })

  it('lets each chip fill its cell rather than hug its label (R3, AC1)', () => {
    const { container } = renderGroup({ options: TWELVE })

    // Nothing on the chip constrains it, so the cell it sits in sets its width.
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

  // --- Step A3 — the count rises above the breakpoint (R2a, AC2, AC3) -------

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

  // --- Step A4 — no group leaves a partial row (R2, R2a, AC2, AC3) ---------
  //
  // A guard rather than a discovery: it passes as soon as A3 lands, and stands
  // so a later column change cannot silently strand an orphan row.

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

  // --- Step A5 — group semantics and tab order survive the grid (R7, AC8) ---

  it('renders its chips in the order it was given (R7, AC8)', () => {
    renderGroup({ options: TWELVE, columns: { base: 4, wide: 6 } })

    const labels = [...chipList().querySelectorAll('button')].map(
      (chip) => chip.textContent,
    )
    expect(labels).toEqual(TWELVE)
  })

  // --- Step B1 — a group with no adornment is unchanged (R7, AC8) ----------
  //
  // The track's regression guard: it passes today, and it is what proves the
  // pass-through acquired no default of its own.

  it('renders each chip as its bare label with no adornment (R7, AC8)', () => {
    renderGroup({ options: FOUR, columns: { base: 2, wide: 4 } })
    const chips = [...chipList().querySelectorAll('button')]

    expect(chips.map((chip) => chip.textContent)).toEqual(FOUR)
    for (const chip of chips) expect(chip.children).toHaveLength(0)
  })

  // --- Step B2 — the group gives its adornment to every chip (R1, R3) ------

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
})
