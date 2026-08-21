import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AttributeSelector } from './AttributeSelector'

describe('AttributeSelector', () => {
  it('renders a toggle for each of the three attributes', () => {
    render(<AttributeSelector selected={[]} onToggle={() => {}} />)
    const toggles = screen.getAllByRole('checkbox')
    expect(toggles).toHaveLength(3)
    expect(screen.getByRole('checkbox', { name: /scale/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /chord/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /progression/i })).toBeInTheDocument()
  })

  it('calls onToggle with the clicked attribute', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<AttributeSelector selected={[]} onToggle={onToggle} />)

    await user.click(screen.getByRole('checkbox', { name: /chord/i }))

    expect(onToggle).toHaveBeenCalledTimes(1)
    expect(onToggle).toHaveBeenCalledWith('chord')
  })

  it('reflects which attributes are selected', () => {
    render(<AttributeSelector selected={['scale']} onToggle={() => {}} />)
    expect(screen.getByRole('checkbox', { name: /scale/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /chord/i })).not.toBeChecked()
    expect(screen.getByRole('checkbox', { name: /progression/i })).not.toBeChecked()
  })

  it('blocks toggling when disabled', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<AttributeSelector selected={[]} onToggle={onToggle} disabled />)

    await user.click(screen.getByRole('checkbox', { name: /scale/i }))

    expect(onToggle).not.toHaveBeenCalled()
    for (const toggle of screen.getAllByRole('checkbox')) {
      expect(toggle).toBeDisabled()
    }
  })
})
