import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayControl } from './PlayControl'

describe('PlayControl', () => {
  it('calls onPlay when clicked', async () => {
    const user = userEvent.setup()
    const onPlay = vi.fn()
    render(<PlayControl onPlay={onPlay} isPlaying={false} />)

    await user.click(screen.getByRole('button'))

    expect(onPlay).toHaveBeenCalledTimes(1)
  })

  it('reflects the playing state via aria-pressed', () => {
    const { rerender } = render(<PlayControl onPlay={() => {}} isPlaying={false} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'false')

    rerender(<PlayControl onPlay={() => {}} isPlaying={true} />)
    expect(screen.getByRole('button')).toHaveAttribute('aria-pressed', 'true')
  })

  it('uses the provided label', () => {
    render(<PlayControl onPlay={() => {}} isPlaying={false} label="Play groove" />)
    expect(screen.getByRole('button', { name: /play groove/i })).toBeInTheDocument()
  })

  it('can still be clicked while playing (replay)', async () => {
    const user = userEvent.setup()
    const onPlay = vi.fn()
    render(<PlayControl onPlay={onPlay} isPlaying={true} />)

    await user.click(screen.getByRole('button'))

    expect(onPlay).toHaveBeenCalledTimes(1)
  })
})
