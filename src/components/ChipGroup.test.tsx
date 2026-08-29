import { describe, expect, it, vi } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChipGroup } from './ChipGroup'

const OPTIONS = ['One', 'Two', 'Three']

function renderGroup(overrides: Partial<Parameters<typeof ChipGroup>[0]> = {}) {
  const props = {
    label: 'Group',
    options: OPTIONS,
    value: null as string | null,
    onSelect: () => {},
    disabled: false,
    name: 'group',
    ...overrides,
  }
  return render(<ChipGroup {...props} />)
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

  it('passes a fixed width down to every chip when asked', () => {
    const { container } = renderGroup({ width: 'fixed' })
    const chips = [...container.querySelectorAll('button')] as HTMLElement[]

    expect(chips).toHaveLength(OPTIONS.length)
    for (const chip of chips) expect(chip.className).toMatch(/\bw-\[/)
  })

  it('lets its chips hug their labels by default', () => {
    const { container } = renderGroup()
    for (const chip of [...container.querySelectorAll('button')]) {
      expect(chip.className).not.toMatch(/\bw-\[/)
    }
  })

  it('wraps its chips instead of overflowing', () => {
    renderGroup()
    const group = screen.getByRole('radiogroup', { name: 'Group' })
    const list = group.querySelector('[data-testid="chip-list"]') as HTMLElement

    expect(list).not.toBeNull()
    expect(list.className).toContain('flex-wrap')
    expect(list.className).not.toMatch(/\bw-\[/)
    expect(list.className).not.toMatch(/\bmin-w-/)
    expect(list.className).not.toMatch(/overflow-x/)
  })
})
