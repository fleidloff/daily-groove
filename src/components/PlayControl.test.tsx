import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayControl } from './PlayControl'

describe('PlayControl', () => {
  it('offers to play when not playing', () => {
    render(<PlayControl isPlaying={false} onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: 'Play the loop' })).toBeInTheDocument()
  })

  it('offers to pause when playing', () => {
    render(<PlayControl isPlaying onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: 'Pause the loop' })).toBeInTheDocument()
  })

  it('swaps its accessible name as the state changes', () => {
    const { rerender } = render(<PlayControl isPlaying={false} onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAccessibleName('Play the loop')

    rerender(<PlayControl isPlaying onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAccessibleName('Pause the loop')
  })

  it('calls onToggle when pressed while stopped', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<PlayControl isPlaying={false} onToggle={onToggle} />)

    await user.click(screen.getByRole('button'))

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('calls onToggle when pressed while playing', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<PlayControl isPlaying onToggle={onToggle} />)

    await user.click(screen.getByRole('button'))

    expect(onToggle).toHaveBeenCalledTimes(1)
  })
})
