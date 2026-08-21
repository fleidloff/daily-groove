import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AttributePicker } from './AttributePicker'

const CHORD_OPTIONS = ['Dmaj7', 'A7', 'Cm7', 'Fmaj7']
const SCALE_OPTIONS = ['C minor', 'A dorian', 'G major', 'E phrygian']

describe('AttributePicker', () => {
  it('renders exactly the given options', () => {
    render(
      <AttributePicker
        attribute="chord"
        options={CHORD_OPTIONS}
        value={null}
        onSelect={() => {}}
      />,
    )
    const radios = screen.getAllByRole('radio')
    expect(radios).toHaveLength(CHORD_OPTIONS.length)
    for (const label of CHORD_OPTIONS) {
      expect(screen.getByRole('radio', { name: label })).toBeInTheDocument()
    }
  })

  it('calls onSelect with the picked value', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <AttributePicker
        attribute="chord"
        options={CHORD_OPTIONS}
        value={null}
        onSelect={onSelect}
      />,
    )

    await user.click(screen.getByRole('radio', { name: 'A7' }))

    expect(onSelect).toHaveBeenCalledTimes(1)
    expect(onSelect).toHaveBeenCalledWith('A7')
  })

  it('reflects the selected value', () => {
    render(
      <AttributePicker
        attribute="chord"
        options={CHORD_OPTIONS}
        value="Dmaj7"
        onSelect={() => {}}
      />,
    )
    expect(screen.getByRole('radio', { name: 'Dmaj7' })).toBeChecked()
  })

  it('behaves identically for the scale attribute', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <AttributePicker
        attribute="scale"
        options={SCALE_OPTIONS}
        value="G major"
        onSelect={onSelect}
      />,
    )
    expect(screen.getAllByRole('radio')).toHaveLength(SCALE_OPTIONS.length)
    expect(screen.getByRole('radio', { name: 'G major' })).toBeChecked()

    await user.click(screen.getByRole('radio', { name: 'A dorian' }))
    expect(onSelect).toHaveBeenCalledWith('A dorian')
  })

  it('labels the picker by its attribute', () => {
    render(
      <AttributePicker
        attribute="progression"
        options={['Dm–G–C']}
        value={null}
        onSelect={() => {}}
      />,
    )
    expect(screen.getByText(/progression/i)).toBeInTheDocument()
  })

  it('locks the picker when disabled', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(
      <AttributePicker
        attribute="chord"
        options={CHORD_OPTIONS}
        value={null}
        onSelect={onSelect}
        disabled
      />,
    )

    await user.click(screen.getByRole('radio', { name: 'A7' }))

    expect(onSelect).not.toHaveBeenCalled()
    for (const radio of screen.getAllByRole('radio')) {
      expect(radio).toBeDisabled()
    }
  })
})
