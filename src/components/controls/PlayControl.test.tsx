import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PlayControl } from './PlayControl'

describe('PlayControl', () => {
  it('offers to play when not playing', () => {
    render(<PlayControl isPlaying={false} onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: 'Play the loop' })).toBeInTheDocument()
  })

  it('offers to stop when playing', () => {
    render(<PlayControl isPlaying onToggle={() => {}} />)
    expect(screen.getByRole('button', { name: 'Stop the loop' })).toBeInTheDocument()
  })

  it('swaps its accessible name as the state changes', () => {
    const { rerender } = render(<PlayControl isPlaying={false} onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAccessibleName('Play the loop')

    rerender(<PlayControl isPlaying onToggle={() => {}} />)
    expect(screen.getByRole('button')).toHaveAccessibleName('Stop the loop')
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

  describe('size="lg"', () => {
    it('renders full-width with the glyph and its text (A1, R1, R4a, AC1, AC3a)', () => {
      render(<PlayControl size="lg" isPlaying={false} onToggle={() => {}} />)

      const button = screen.getByRole('button')
      expect(button).toHaveTextContent('▶ Play')
      expect(button.className).toContain('w-full')
    })

    it('renders caller-supplied words in BOTH states (R4a, AC3a)', () => {
      // The design system carries no domain vocabulary (globals I5), so the
      // words arrive as a prop. Both halves must be honoured: a control that
      // used `text.play` and ignored `text.stop` passed the whole suite before
      // this assertion existed.
      // Both words differ from the component's own defaults ('Play' / 'Stop').
      // A fixture reusing a default cannot distinguish "the prop was honoured"
      // from "the prop was ignored" — it passes either way.
      const text = { play: 'Start it', stop: 'Halt it' }

      const { rerender } = render(
        <PlayControl size="lg" isPlaying={false} onToggle={() => {}} text={text} />,
      )
      expect(screen.getByRole('button')).toHaveTextContent('▶ Start it')

      rerender(<PlayControl size="lg" isPlaying onToggle={() => {}} text={text} />)
      expect(screen.getByRole('button')).toHaveTextContent('■ Halt it')
    })

    it("inherits the solve button's geometry rather than restating it (A1, R1, AC1)", () => {
      render(<PlayControl size="lg" isPlaying={false} onToggle={() => {}} />)

      const className = screen.getByRole('button').className
      for (const geometry of ['w-full', 'rounded-control', 'px-4', 'py-[15px]', 'text-[15px]']) {
        expect(className).toContain(geometry)
      }
    })

    it('swaps to the stop glyph and text while sounding (A2, R4b, AC3a)', () => {
      render(<PlayControl size="lg" isPlaying onToggle={() => {}} />)

      expect(screen.getByRole('button')).toHaveTextContent('■ Stop')
    })

    it('differs between the two states in glyph and text only (A2, R4b, AC3b)', () => {
      const classOf = (isPlaying: boolean) =>
        (
          render(<PlayControl size="lg" isPlaying={isPlaying} onToggle={() => {}} />)
            .container.firstElementChild as HTMLElement
        ).className

      const stopped = classOf(false)
      const playing = classOf(true)

      expect(playing).toBe(stopped)
    })

    it('states the action, not the state, in its accessible name (A3, R5, AC4)', () => {
      const { rerender } = render(
        <PlayControl size="lg" isPlaying={false} onToggle={() => {}} />,
      )
      expect(screen.getByRole('button')).toHaveAccessibleName('Play the loop')

      rerender(<PlayControl size="lg" isPlaying onToggle={() => {}} />)
      expect(screen.getByRole('button')).toHaveAccessibleName('Stop the loop')
    })

    it('calls onToggle when pressed', async () => {
      const user = userEvent.setup()
      const onToggle = vi.fn()
      render(<PlayControl size="lg" isPlaying={false} onToggle={onToggle} />)

      await user.click(screen.getByRole('button'))

      expect(onToggle).toHaveBeenCalledTimes(1)
    })
  })

  describe('size="sm"', () => {
    it('is the default when no size is given, and stays the circular control (A4, R3, AC2)', () => {
      const { container } = render(<PlayControl isPlaying={false} onToggle={() => {}} />)

      const className = (container.firstElementChild as HTMLElement).className
      for (const geometry of ['h-[52px]', 'w-[52px]', 'rounded-full']) {
        expect(className).toContain(geometry)
      }
    })

    it('renders the glyph alone, with no text beside it (A4, R3, AC2)', () => {
      render(<PlayControl isPlaying={false} onToggle={() => {}} />)
      expect(screen.getByRole('button')).toHaveTextContent('▶')
      expect(screen.getByRole('button').textContent?.trim()).toBe('▶')

      render(<PlayControl size="sm" isPlaying onToggle={() => {}} />)
      const [, playing] = screen.getAllByRole('button')
      expect(playing.textContent?.trim()).toBe('■')
    })

    it('renders identically whether size is omitted or passed explicitly (A4, R3, AC2)', () => {
      const implicit = render(<PlayControl isPlaying={false} onToggle={() => {}} />)
        .container.innerHTML
      const explicit = render(
        <PlayControl size="sm" isPlaying={false} onToggle={() => {}} />,
      ).container.innerHTML

      expect(explicit).toBe(implicit)
    })
  })

  describe('label override (C1, R6, AC6)', () => {
    it('overrides the accessible name at size="sm"', () => {
      render(
        <PlayControl
          size="sm"
          isPlaying={false}
          onToggle={() => {}}
          label="Play Tuesday's loop"
        />,
      )

      expect(screen.getByRole('button')).toHaveAccessibleName("Play Tuesday's loop")
    })

    it('overrides the accessible name at size="lg"', () => {
      render(
        <PlayControl
          size="lg"
          isPlaying={false}
          onToggle={() => {}}
          label="Play Tuesday's loop"
        />,
      )

      expect(screen.getByRole('button')).toHaveAccessibleName("Play Tuesday's loop")
    })

    it('overrides the sounding name too, at both sizes', () => {
      render(<PlayControl size="sm" isPlaying label="Stop Tuesday's loop" onToggle={() => {}} />)
      render(<PlayControl size="lg" isPlaying label="Stop Tuesday's loop" onToggle={() => {}} />)

      const [small, large] = screen.getAllByRole('button')
      expect(small).toHaveAccessibleName("Stop Tuesday's loop")
      expect(large).toHaveAccessibleName("Stop Tuesday's loop")
    })

    it('falls back to the derived name when no label is given, at both sizes', () => {
      render(<PlayControl size="sm" isPlaying={false} onToggle={() => {}} />)
      render(<PlayControl size="lg" isPlaying={false} onToggle={() => {}} />)

      const [small, large] = screen.getAllByRole('button')
      expect(small).toHaveAccessibleName('Play the loop')
      expect(large).toHaveAccessibleName('Play the loop')
    })

    it('keeps the visible text of the large control unchanged by the label', () => {
      render(
        <PlayControl
          size="lg"
          isPlaying={false}
          onToggle={() => {}}
          label="Play Tuesday's loop"
        />,
      )

      expect(screen.getByRole('button')).toHaveTextContent('▶ Play')
    })
  })

  describe('disabled (C2, R10, AC12)', () => {
    it('renders a disabled button at size="sm"', () => {
      render(
        <PlayControl
          size="sm"
          isPlaying={false}
          onToggle={() => {}}
          disabled
          label="Tuesday's loop is unavailable"
        />,
      )

      expect(
        screen.getByRole('button', { name: "Tuesday's loop is unavailable" }),
      ).toBeDisabled()
    })

    it('renders a disabled button at size="lg"', () => {
      render(
        <PlayControl
          size="lg"
          isPlaying={false}
          onToggle={() => {}}
          disabled
          label="Tuesday's loop is unavailable"
        />,
      )

      expect(
        screen.getByRole('button', { name: "Tuesday's loop is unavailable" }),
      ).toBeDisabled()
    })

    it('does not call onToggle when pressed while disabled, at size="sm"', async () => {
      const user = userEvent.setup()
      const onToggle = vi.fn()
      render(<PlayControl size="sm" isPlaying={false} onToggle={onToggle} disabled />)

      await user.click(screen.getByRole('button'))

      expect(onToggle).not.toHaveBeenCalled()
    })

    it('does not call onToggle when pressed while disabled, at size="lg"', async () => {
      const user = userEvent.setup()
      const onToggle = vi.fn()
      render(<PlayControl size="lg" isPlaying={false} onToggle={onToggle} disabled />)

      await user.click(screen.getByRole('button'))

      expect(onToggle).not.toHaveBeenCalled()
    })

    it('stays enabled when disabled is omitted, at both sizes', () => {
      render(<PlayControl size="sm" isPlaying={false} onToggle={() => {}} />)
      render(<PlayControl size="lg" isPlaying={false} onToggle={() => {}} />)

      for (const button of screen.getAllByRole('button')) {
        expect(button).toBeEnabled()
      }
    })
  })
})
