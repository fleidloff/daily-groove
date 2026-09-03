import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayControl } from './PlayControl'

const TEXT = { play: 'Play', stop: 'Stop', loading: 'Loading…' }
const NAME = { play: 'Play the loop', stop: 'Stop the loop' }

describe('PlayControl', () => {
  it('offers to play when not playing', () => {
    render(<PlayControl isPlaying={false} onToggle={() => {}} text={TEXT} name={NAME} />)
    expect(screen.getByRole('button', { name: 'Play the loop' })).toBeInTheDocument()
  })

  it('offers to stop when playing', () => {
    render(<PlayControl isPlaying onToggle={() => {}} text={TEXT} name={NAME} />)
    expect(screen.getByRole('button', { name: 'Stop the loop' })).toBeInTheDocument()
  })

  it('swaps its accessible name as the state changes', () => {
    const { rerender } = render(
      <PlayControl isPlaying={false} onToggle={() => {}} text={TEXT} name={NAME} />,
    )
    expect(screen.getByRole('button')).toHaveAccessibleName('Play the loop')

    rerender(<PlayControl isPlaying onToggle={() => {}} text={TEXT} name={NAME} />)
    expect(screen.getByRole('button')).toHaveAccessibleName('Stop the loop')
  })

  it('calls onToggle when pressed while stopped', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<PlayControl isPlaying={false} onToggle={onToggle} text={TEXT} name={NAME} />)

    await user.click(screen.getByRole('button'))

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('calls onToggle when pressed while playing', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(<PlayControl isPlaying onToggle={onToggle} text={TEXT} name={NAME} />)

    await user.click(screen.getByRole('button'))

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('renders the large full-width button form with no size given (D1, B2, R9, R6, AC8a, AC5)', () => {
    render(<PlayControl isPlaying={false} onToggle={() => {}} text={TEXT} name={NAME} />)

    const button = screen.getByRole('button', { name: 'Play the loop' })
    expect(button).toHaveTextContent('▶ Play')
    expect(button.className).toContain('w-full')
    expect(button.className).toContain('py-[22px]')
    expect(button).toBeEnabled()
  })

  it('renders full-width with the glyph and its text (A1, R1, R4a, AC1, AC3a)', () => {
    render(<PlayControl isPlaying={false} onToggle={() => {}} text={TEXT} name={NAME} />)

    const button = screen.getByRole('button')
    expect(button).toHaveTextContent('▶ Play')
    expect(button.className).toContain('w-full')
  })

  it('renders caller-supplied words in BOTH states (R4a, AC3a)', () => {
    const text = { play: 'Start it', stop: 'Halt it', loading: 'Fetching…' }

    const { rerender } = render(
      <PlayControl isPlaying={false} onToggle={() => {}} text={text} name={NAME} />,
    )
    expect(screen.getByRole('button')).toHaveTextContent('▶ Start it')

    rerender(<PlayControl isPlaying onToggle={() => {}} text={text} name={NAME} />)
    expect(screen.getByRole('button')).toHaveTextContent('■ Halt it')
  })

  it('renders caller-supplied accessible names in BOTH states (R5, AC4)', () => {
    const name = { play: 'Begin', stop: 'End' }

    const { rerender } = render(
      <PlayControl isPlaying={false} onToggle={() => {}} text={TEXT} name={name} />,
    )
    expect(screen.getByRole('button')).toHaveAccessibleName('Begin')

    rerender(<PlayControl isPlaying onToggle={() => {}} text={TEXT} name={name} />)
    expect(screen.getByRole('button')).toHaveAccessibleName('End')
  })

  it("takes the large form of the one button, not the solve button's size (B1, R4, R7, AC4)", () => {
    render(<PlayControl isPlaying={false} onToggle={() => {}} text={TEXT} name={NAME} />)

    const className = screen.getByRole('button').className
    for (const geometry of ['w-full', 'rounded-control', 'px-4', 'py-[22px]', 'text-[17px]']) {
      expect(className).toContain(geometry)
    }
  })

  it('swaps to the stop glyph and text while sounding, at the same size (A2, B2, R4b, R6, AC3a, AC5)', () => {
    render(<PlayControl isPlaying onToggle={() => {}} text={TEXT} name={NAME} />)

    const button = screen.getByRole('button')
    expect(button).toHaveTextContent('■ Stop')
    expect(button).toHaveAccessibleName('Stop the loop')
    expect(button.className).toContain('py-[22px]')
  })

  it('differs between the two states in glyph and text only (A2, R4b, AC3b)', () => {
    const classOf = (isPlaying: boolean) =>
      (
        render(<PlayControl isPlaying={isPlaying} onToggle={() => {}} text={TEXT} name={NAME} />)
          .container.firstElementChild as HTMLElement
      ).className

    const stopped = classOf(false)
    const playing = classOf(true)

    expect(playing).toBe(stopped)
  })

  it('states the action, not the state, in its accessible name (A3, R5, AC4)', () => {
    const { rerender } = render(
      <PlayControl isPlaying={false} onToggle={() => {}} text={TEXT} name={NAME} />,
    )
    expect(screen.getByRole('button')).toHaveAccessibleName('Play the loop')

    rerender(<PlayControl isPlaying onToggle={() => {}} text={TEXT} name={NAME} />)
    expect(screen.getByRole('button')).toHaveAccessibleName('Stop the loop')
  })

  it("keeps the caller's name whatever words the caller supplies (D1, R9, AC8a)", () => {
    render(
      <PlayControl
        isPlaying={false}
        onToggle={() => {}}
        text={{ play: 'Play the whole thing', stop: 'Stop', loading: 'Fetching…' }}
        name={NAME}
      />,
    )

    expect(screen.getByRole('button')).toHaveAccessibleName('Play the loop')
  })

  it('renders inert at the same size with the loading word while busy (C1, B2, R7a, R6, AC8b, AC5, AC6)', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    render(
      <PlayControl
        isPlaying={false}
        busy
        onToggle={onToggle}
        text={{ play: 'Start it', stop: 'Halt it', loading: 'Fetching…' }}
        name={NAME}
      />,
    )

    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    expect(button).toHaveTextContent('◌ Fetching…')
    expect(button).not.toHaveTextContent('Start it')
    expect(button).toHaveAccessibleName('Fetching…')
    expect(button.className).toContain('py-[22px]')

    await user.click(button)

    expect(onToggle).not.toHaveBeenCalled()
  })

  it('says it is loading in its accessible name while busy (C1, R7a, AC8b)', () => {
    render(
      <PlayControl
        isPlaying={false}
        busy
        onToggle={() => {}}
        text={{ play: 'Start it', stop: 'Halt it', loading: 'Fetching…' }}
        name={NAME}
      />,
    )

    expect(screen.getByRole('button')).toHaveAccessibleName('Fetching…')
  })

  it('is busy over either state (C1, R7a, AC8b)', () => {
    const { rerender } = render(
      <PlayControl isPlaying busy onToggle={() => {}} text={TEXT} name={NAME} />,
    )

    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByRole('button')).toHaveTextContent('Loading…')
    expect(screen.getByRole('button')).not.toHaveTextContent('Stop')

    rerender(<PlayControl isPlaying={false} busy onToggle={() => {}} text={TEXT} name={NAME} />)

    expect(screen.getByRole('button')).toBeDisabled()
    expect(screen.getByRole('button')).toHaveTextContent('Loading…')
  })

  it('leaves the busy state when the prop clears while playing (C2, R7a, AC8c)', async () => {
    const user = userEvent.setup()
    const onToggle = vi.fn()
    const text = { play: 'Start it', stop: 'Halt it', loading: 'Fetching…' }
    const { rerender } = render(
      <PlayControl isPlaying={false} busy onToggle={onToggle} text={text} name={NAME} />,
    )

    rerender(
      <PlayControl isPlaying busy={false} onToggle={onToggle} text={text} name={NAME} />,
    )

    const button = screen.getByRole('button')
    expect(button).toBeEnabled()
    expect(button).toHaveTextContent('■ Halt it')
    expect(button).toHaveAccessibleName('Stop the loop')

    await user.click(button)

    expect(onToggle).toHaveBeenCalledTimes(1)
  })

  it('leaves the busy state when a failed press clears the prop (C2, R7a, AC8d)', () => {
    const text = { play: 'Start it', stop: 'Halt it', loading: 'Fetching…' }
    const { rerender } = render(
      <PlayControl isPlaying={false} busy onToggle={() => {}} text={text} name={NAME} />,
    )

    rerender(
      <PlayControl isPlaying={false} busy={false} onToggle={() => {}} text={text} name={NAME} />,
    )

    const button = screen.getByRole('button')
    expect(button).toBeEnabled()
    expect(button).toHaveTextContent('▶ Start it')
    expect(button).toHaveAccessibleName('Play the loop')
  })

  it('is enabled when busy is omitted (C1, R7a)', () => {
    render(<PlayControl isPlaying={false} onToggle={() => {}} text={TEXT} name={NAME} />)

    expect(screen.getByRole('button')).toBeEnabled()
    expect(screen.getByRole('button')).toHaveTextContent('▶ Play')
  })
})
