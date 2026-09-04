import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Select } from './Select'

const SIZES = [
  { value: 'S', label: 'Small' },
  { value: 'M', label: 'Medium' },
  { value: 'L', label: 'Large' },
] as const

const SHORT = SIZES.map((size) => ({ ...size, short: size.value }))

const box = () => screen.getByRole('combobox', { name: 'Size' })
const shown = (text: string) =>
  screen.getAllByText(text).find((el) => el.tagName === 'SPAN') as HTMLElement

describe('Select', () => {
  it('is a combobox named by its label, holding the current value', () => {
    render(<Select label="Size" value="M" options={SIZES} onChange={vi.fn()} />)
    expect(box()).toHaveValue('M')
  })

  it('shows the label and the picked option beside it', () => {
    render(<Select label="Size" value="M" options={SIZES} onChange={vi.fn()} />)
    expect(screen.getByText('Size')).toBeVisible()
    expect(shown('Medium')).toBeVisible()
  })

  it('shows a short stand-in for the picked option where one is given', () => {
    render(<Select label="Size" value="M" options={SHORT} onChange={vi.fn()} />)
    expect(shown('M')).toBeVisible()
    expect(screen.getAllByText('Medium')).toHaveLength(1)
    expect(screen.getAllByText('Medium')[0].tagName).toBe('OPTION')
  })

  it('renders one option per entry, in order', () => {
    render(<Select label="Size" value="S" options={SIZES} onChange={vi.fn()} />)
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Small',
      'Medium',
      'Large',
    ])
  })

  it('reports the picked value once', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Select label="Size" value="S" options={SIZES} onChange={onChange} />)

    await user.selectOptions(box(), 'L')

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('L')
  })

  it('lets the picker take a tap anywhere on the control, label included', () => {
    render(<Select label="Size" value="S" options={SIZES} onChange={vi.fn()} />)
    expect(box().className).toContain('absolute inset-0')
    expect(screen.getByText('Size').className).toContain('pointer-events-none')
    expect(shown('Small').className).toContain('pointer-events-none')
  })

  it('takes focus from the keyboard and shows it on the control', async () => {
    const user = userEvent.setup()
    render(<Select label="Size" value="S" options={SIZES} onChange={vi.fn()} />)

    await user.tab()

    expect(box()).toHaveFocus()
    const wrap = screen.getByText('Size').parentElement as HTMLElement
    expect(wrap.className).toContain('has-[select:focus-visible]:outline-2')
  })

  it('names the control by the label the user can see', () => {
    render(<Select label="Size" value="S" options={SIZES} onChange={vi.fn()} />)
    const visible = screen.getByText('Size')
    expect(box().getAttribute('aria-labelledby')).toBe(visible.id)
    expect(visible.id).not.toBe('')
    expect(box()).not.toHaveAttribute('aria-label')
  })

  it('changes the picked value from the keyboard alone', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<Select label="Size" value="S" options={SIZES} onChange={onChange} />)

    await user.tab()
    await user.selectOptions(box(), 'M')

    expect(onChange).toHaveBeenCalledWith('M')
    expect(box()).toHaveFocus()
  })

  it('shows nothing rather than a value the options do not carry', () => {
    render(
      <Select
        label="Size"
        value={'XL' as 'S'}
        options={SIZES}
        onChange={vi.fn()}
      />,
    )
    expect(screen.queryByText('XL')).toBeNull()
  })

  it('skips focus and the picker when disabled', async () => {
    const user = userEvent.setup()
    render(
      <Select label="Size" value="S" options={SIZES} onChange={vi.fn()} disabled />,
    )

    await user.tab()

    expect(box()).toBeDisabled()
    expect(box()).not.toHaveFocus()
  })

  it('wears the pill silhouette', () => {
    render(<Select label="Size" value="S" options={SIZES} onChange={vi.fn()} />)
    const wrap = screen.getByText('Size').parentElement as HTMLElement
    expect(wrap.className).toContain('rounded-full')
    expect(wrap).toContainElement(box())
  })

})
