import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Button } from './Button'

describe('Button', () => {
  it('renders its children', () => {
    render(
      <Button onPress={() => {}} disabled={false} tone="ready">
        Continue
      </Button>,
    )
    expect(screen.getByRole('button', { name: 'Continue' })).toBeInTheDocument()
  })

  it('is a type="button" so it never submits a form', () => {
    render(
      <Button onPress={() => {}} disabled={false} tone="ready">
        Go
      </Button>,
    )
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button')
  })

  it('calls onPress once when pressed', async () => {
    const user = userEvent.setup()
    const onPress = vi.fn()
    render(
      <Button onPress={onPress} disabled={false} tone="ready">
        Go
      </Button>,
    )

    await user.click(screen.getByRole('button', { name: 'Go' }))

    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('blocks onPress and sets the disabled attribute while disabled', async () => {
    const user = userEvent.setup()
    const onPress = vi.fn()
    render(
      <Button onPress={onPress} disabled tone="idle">
        Not ready yet
      </Button>,
    )

    const button = screen.getByRole('button', { name: 'Not ready yet' })
    expect(button).toBeDisabled()
    await user.click(button)

    expect(onPress).not.toHaveBeenCalled()
  })

  it('gives the three tones distinct class strings', () => {
    const classOf = (tone: 'idle' | 'ready' | 'solved') =>
      (
        render(
          <Button onPress={() => {}} disabled={false} tone={tone}>
            Go
          </Button>,
        ).container.firstElementChild as HTMLElement
      ).className

    const idle = classOf('idle')
    const ready = classOf('ready')
    const solved = classOf('solved')

    expect(new Set([idle, ready, solved]).size).toBe(3)
  })

  it('spans the full width of its container', () => {
    const { container } = render(
      <Button onPress={() => {}} disabled={false} tone="ready">
        Go
      </Button>,
    )
    expect((container.firstElementChild as HTMLElement).className).toContain('w-full')
  })
})
