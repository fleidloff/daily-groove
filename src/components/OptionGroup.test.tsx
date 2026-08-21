import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OptionGroup } from './OptionGroup'

const OPTIONS = ['C minor', 'A dorian', 'G major', 'E phrygian']

describe('OptionGroup', () => {
  it('renders all options as radio inputs', () => {
    render(<OptionGroup options={OPTIONS} value={null} onChange={() => {}} name="scale" />)
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(OPTIONS.length)
    for (const label of OPTIONS) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument()
    }
  })

  it('calls onChange with the clicked option value', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<OptionGroup options={OPTIONS} value={null} onChange={onChange} name="scale" />)

    await user.click(screen.getByRole('radio', { name: 'A dorian' }))

    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith('A dorian')
  })

  it('marks exactly one option as selected based on value', () => {
    render(<OptionGroup options={OPTIONS} value="G major" onChange={() => {}} name="scale" />)
    const checked = screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)
    expect(checked).toHaveLength(1)
    expect(screen.getByRole('radio', { name: 'G major' })).toBeChecked()
  })

  it('shows no option selected when value is null', () => {
    render(<OptionGroup options={OPTIONS} value={null} onChange={() => {}} name="scale" />)
    const checked = screen.getAllByRole('radio').filter((r) => (r as HTMLInputElement).checked)
    expect(checked).toHaveLength(0)
  })

  it('does nothing on click when disabled', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <OptionGroup options={OPTIONS} value={null} onChange={onChange} name="scale" disabled />,
    )

    await user.click(screen.getByRole('radio', { name: 'A dorian' }))

    expect(onChange).not.toHaveBeenCalled()
  })

  it('disables every radio input when disabled', () => {
    render(<OptionGroup options={OPTIONS} value="C minor" onChange={() => {}} name="scale" disabled />)
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled()
    }
  })

  it('groups radios under a shared radiogroup', () => {
    render(<OptionGroup options={OPTIONS} value={null} onChange={() => {}} name="scale" />)
    expect(screen.getByRole('radiogroup')).toBeInTheDocument()
  })
})
