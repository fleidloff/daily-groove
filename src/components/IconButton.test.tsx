import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { IconButton } from './IconButton'

describe('IconButton', () => {
  it('takes its accessible name from the label', () => {
    render(<IconButton onPress={() => {}} label="Play the loop" glyph="▶" />)
    expect(
      screen.getByRole('button', { name: 'Play the loop' }),
    ).toBeInTheDocument()
  })

  it('calls onPress once when clicked', async () => {
    const user = userEvent.setup()
    const onPress = vi.fn()
    render(<IconButton onPress={onPress} label="Play the loop" glyph="▶" />)

    await user.click(screen.getByRole('button', { name: 'Play the loop' }))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('hides the glyph from assistive technology', () => {
    render(<IconButton onPress={() => {}} label="Pause the loop" glyph="■" />)
    const button = screen.getByRole('button', { name: 'Pause the loop' })
    const glyph = button.querySelector('[aria-hidden="true"]')

    expect(glyph).not.toBeNull()
    expect(glyph).toHaveTextContent('■')
  })

  it('is a type="button" so it never submits a form', () => {
    render(<IconButton onPress={() => {}} label="Play the loop" glyph="▶" />)
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  describe('disabled', () => {
    it('sets the disabled attribute when disabled', () => {
      render(<IconButton onPress={() => {}} label="Play the loop" glyph="▶" disabled />)
      expect(screen.getByRole('button', { name: 'Play the loop' })).toBeDisabled()
    })

    it('blocks onPress while disabled', async () => {
      const user = userEvent.setup()
      const onPress = vi.fn()
      render(<IconButton onPress={onPress} label="Play the loop" glyph="▶" disabled />)

      await user.click(screen.getByRole('button', { name: 'Play the loop' }))

      expect(onPress).not.toHaveBeenCalled()
    })

    it('is enabled when the prop is omitted', () => {
      render(<IconButton onPress={() => {}} label="Play the loop" glyph="▶" />)
      expect(screen.getByRole('button')).toBeEnabled()
    })

    it("carries the design system's disabled styling", () => {
      render(<IconButton onPress={() => {}} label="Play the loop" glyph="▶" disabled />)

      const className = screen.getByRole('button').className
      expect(className).toContain('disabled:cursor-default')
      expect(className).toContain('disabled:opacity-60')
    })
  })
})
